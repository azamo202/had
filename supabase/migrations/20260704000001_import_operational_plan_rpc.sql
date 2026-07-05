-- Migration for import_operational_plan RPC
-- Handles idempotency via bottom-up deletion and atomic JSONB insertion

CREATE OR REPLACE FUNCTION public.import_operational_plan(payload JSONB)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    sheet JSONB;
    sub_g JSONB;
    init JSONB;
    proj JSONB;
    kpi JSONB;
    month_data JSONB;
    anom JSONB;
    
    v_sheet_id SMALLINT;
    v_goal_id INTEGER;
    v_sub_goal_id INTEGER;
    v_initiative_id INTEGER;
    v_project_id INTEGER;
    v_kpi_id INTEGER;
    v_quarter_num SMALLINT;
BEGIN
    -- Ensure month labels are populated
    INSERT INTO public.month_labels (month_number, month_name_ar) VALUES
        (1,'يناير'),(2,'فبراير'),(3,'مارس'),(4,'أبريل'),(5,'مايو'),(6,'يونيو'),
        (7,'يوليه'),(8,'أغسطس'),(9,'سبتمبر'),(10,'أكتوبر'),(11,'نوفمبر'),(12,'ديسمبر')
    ON CONFLICT (month_number) DO NOTHING;

    FOR sheet IN SELECT * FROM jsonb_array_elements(payload->'sheets')
    LOOP
        v_sheet_id := (sheet->>'sheet_id')::SMALLINT;

        -- 1. Idempotency: Bottom-up deletion based on sheet_id
        SELECT goal_id INTO v_goal_id FROM public.strategic_goals WHERE sheet_id = v_sheet_id;
        IF FOUND THEN
            DELETE FROM public.kpi_monthly_tracking WHERE kpi_id IN (
                SELECT kpi_id FROM public.project_kpis WHERE project_id IN (
                    SELECT project_id FROM public.operational_projects WHERE initiative_id IN (
                        SELECT initiative_id FROM public.initiatives WHERE sub_goal_id IN (
                            SELECT sub_goal_id FROM public.sub_goals WHERE goal_id = v_goal_id
                        )
                    )
                )
            );
            DELETE FROM public.project_kpis WHERE project_id IN (
                SELECT project_id FROM public.operational_projects WHERE initiative_id IN (
                    SELECT initiative_id FROM public.initiatives WHERE sub_goal_id IN (
                        SELECT sub_goal_id FROM public.sub_goals WHERE goal_id = v_goal_id
                    )
                )
            );
            DELETE FROM public.operational_projects WHERE initiative_id IN (
                SELECT initiative_id FROM public.initiatives WHERE sub_goal_id IN (
                    SELECT sub_goal_id FROM public.sub_goals WHERE goal_id = v_goal_id
                )
            );
            DELETE FROM public.initiative_quarters WHERE initiative_id IN (
                SELECT initiative_id FROM public.initiatives WHERE sub_goal_id IN (
                    SELECT sub_goal_id FROM public.sub_goals WHERE goal_id = v_goal_id
                )
            );
            DELETE FROM public.initiatives WHERE sub_goal_id IN (
                SELECT sub_goal_id FROM public.sub_goals WHERE goal_id = v_goal_id
            );
            DELETE FROM public.sub_goals WHERE goal_id = v_goal_id;
            DELETE FROM public.strategic_goals WHERE goal_id = v_goal_id;
        END IF;

        DELETE FROM public.import_anomalies WHERE sheet_name = sheet->>'sheet_name';

        -- 2. Upsert sheet_meta
        INSERT INTO public.sheet_meta (
            sheet_id, sheet_name, column_variant, max_row, max_col, 
            has_execution_cost_column, has_baseline_column, budget_is_split_two_cols, department_header_literal
        ) VALUES (
            v_sheet_id, 
            sheet->>'sheet_name', 
            sheet->>'column_variant', 
            (sheet->>'max_row')::INTEGER, 
            (sheet->>'max_col')::INTEGER, 
            (sheet->>'has_execution_cost_column')::BOOLEAN, 
            (sheet->>'has_baseline_column')::BOOLEAN, 
            (sheet->>'budget_is_split_two_cols')::BOOLEAN, 
            sheet->>'department_header_literal'
        ) ON CONFLICT (sheet_id) DO UPDATE SET
            sheet_name = EXCLUDED.sheet_name,
            column_variant = EXCLUDED.column_variant,
            max_row = EXCLUDED.max_row,
            max_col = EXCLUDED.max_col,
            has_execution_cost_column = EXCLUDED.has_execution_cost_column,
            has_baseline_column = EXCLUDED.has_baseline_column,
            budget_is_split_two_cols = EXCLUDED.budget_is_split_two_cols,
            department_header_literal = EXCLUDED.department_header_literal;

        -- 3. Insert Strategic Goal
        INSERT INTO public.strategic_goals (sheet_id, goal_name)
        VALUES (v_sheet_id, sheet->'goal'->>'الهدف الاستراتيجي')
        RETURNING goal_id INTO v_goal_id;

        -- 4. Sub Goals
        FOR sub_g IN SELECT * FROM jsonb_array_elements(sheet->'sub_goals')
        LOOP
            INSERT INTO public.sub_goals (goal_id, sub_goal_name, source_row_start, source_row_end)
            VALUES (
                v_goal_id, 
                sub_g->>'الهدف الفرعي', 
                (sub_g->>'source_row_start')::INTEGER, 
                (sub_g->>'source_row_end')::INTEGER
            )
            RETURNING sub_goal_id INTO v_sub_goal_id;

            -- 5. Initiatives
            FOR init IN SELECT * FROM jsonb_array_elements(sub_g->'initiatives')
            LOOP
                INSERT INTO public.initiatives (
                    sub_goal_id, initiative_name, 
                    efficiency_kpi_name, efficiency_target_raw, efficiency_target_numeric,
                    effectiveness_kpi_name, effectiveness_target_raw, effectiveness_target_numeric,
                    department_raw, budget_single_numeric, budget_col_I_raw, budget_col_J_raw,
                    timeframe_text, source_row_start, source_row_end
                ) VALUES (
                    v_sub_goal_id, init->>'المبادرة الاستراتيجية ',
                    init->>'efficiency_kpi_name', init->>'efficiency_target_raw', (init->>'efficiency_target_numeric')::NUMERIC,
                    init->>'effectiveness_kpi_name', init->>'effectiveness_target_raw', (init->>'effectiveness_target_numeric')::NUMERIC,
                    init->>'department_raw', (init->>'budget_single_numeric')::NUMERIC, init->>'budget_col_I_raw', init->>'budget_col_J_raw',
                    init->>'timeframe_text', (init->>'source_row_start')::INTEGER, (init->>'source_row_end')::INTEGER
                )
                RETURNING initiative_id INTO v_initiative_id;

                -- Quarters
                FOR v_quarter_num IN 1..4 LOOP
                    DECLARE
                        q_raw TEXT := init->'quarters'->>('الربع ' || v_quarter_num);
                        q_act BOOLEAN := COALESCE((init->'quarters'->>('is_active_' || v_quarter_num))::BOOLEAN, false);
                    BEGIN
                        INSERT INTO public.initiative_quarters (initiative_id, quarter_number, raw_glyph, is_active)
                        VALUES (v_initiative_id, v_quarter_num, q_raw, q_act);
                    END;
                END LOOP;

                -- 6. Operational Projects
                FOR proj IN SELECT * FROM jsonb_array_elements(init->'projects')
                LOOP
                    INSERT INTO public.operational_projects (
                        initiative_id, project_name, execution_cost, source_row_start, source_row_end
                    ) VALUES (
                        v_initiative_id, proj->>'المشاريع التشغيلية للمبادرة', (proj->>'تكلفة التنفيذ')::NUMERIC, 
                        (proj->>'source_row_start')::INTEGER, (proj->>'source_row_end')::INTEGER
                    )
                    RETURNING project_id INTO v_project_id;

                    -- 7. Project KPIs
                    FOR kpi IN SELECT * FROM jsonb_array_elements(proj->'kpis')
                    LOOP
                        INSERT INTO public.project_kpis (
                            project_id, kpi_name, kpi_target_raw, kpi_target_numeric, 
                            baseline_2025_raw, baseline_2025_numeric, source_row
                        ) VALUES (
                            v_project_id, kpi->>'مؤشر القياس', kpi->>'kpi_target_raw', (kpi->>'kpi_target_numeric')::NUMERIC,
                            kpi->>'baseline_2025_raw', (kpi->>'baseline_2025_numeric')::NUMERIC, (kpi->>'source_row')::INTEGER
                        )
                        RETURNING kpi_id INTO v_kpi_id;

                        -- 8. Monthly Tracking
                        FOR month_data IN SELECT * FROM jsonb_array_elements(kpi->'monthly_tracking')
                        LOOP
                            INSERT INTO public.kpi_monthly_tracking (
                                kpi_id, month_number, target_raw, target_numeric,
                                achieved_raw, achieved_numeric, challenges, evidence
                            ) VALUES (
                                v_kpi_id, (month_data->>'month_number')::SMALLINT, 
                                month_data->>'target_raw', (month_data->>'target_numeric')::NUMERIC,
                                month_data->>'achieved_raw', (month_data->>'achieved_numeric')::NUMERIC,
                                month_data->>'challenges', month_data->>'evidence'
                            );
                        END LOOP;
                    END LOOP;
                END LOOP;
            END LOOP;
        END LOOP;
        
        -- Insert anomalies
        IF jsonb_typeof(sheet->'anomalies') = 'array' THEN
            FOR anom IN SELECT * FROM jsonb_array_elements(sheet->'anomalies')
            LOOP
                INSERT INTO public.import_anomalies (
                    sheet_name, cell_ref, anomaly_type, raw_value, note
                ) VALUES (
                    anom->>'sheet_name', anom->>'cell_ref', anom->>'anomaly_type', 
                    anom->>'raw_value', anom->>'note'
                );
            END LOOP;
        END IF;
    END LOOP;
END;
$$;
