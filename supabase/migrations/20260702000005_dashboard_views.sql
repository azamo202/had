-- Dashboard Views

-- 1. Overall Dashboard Aggregation
CREATE OR REPLACE VIEW vw_dashboard AS
SELECT 
    (SELECT COUNT(*) FROM strategic_goals) as total_goals,
    (SELECT COUNT(*) FROM strategic_objectives) as total_objectives,
    (SELECT COUNT(*) FROM strategic_initiatives) as total_initiatives,
    (SELECT COUNT(*) FROM operational_projects) as total_projects,
    (SELECT COUNT(*) FROM operational_projects op JOIN statuses s ON op.status_id = s.id WHERE s.name = 'مكتمل') as projects_completed,
    (SELECT COUNT(*) FROM operational_projects op JOIN statuses s ON op.status_id = s.id WHERE s.name = 'على المسار') as projects_on_track,
    (SELECT COUNT(*) FROM operational_projects op JOIN statuses s ON op.status_id = s.id WHERE s.name = 'يحتاج انتباه') as projects_attention,
    (SELECT COUNT(*) FROM operational_projects op JOIN statuses s ON op.status_id = s.id WHERE s.name = 'متعثر') as projects_delayed,
    (SELECT COUNT(*) FROM operational_projects op JOIN statuses s ON op.status_id = s.id WHERE s.name = 'لم يبدأ') as projects_not_started;

-- 2. Department Progress View
-- This view aggregates project progress by organization unit
CREATE OR REPLACE VIEW vw_department_progress AS
SELECT 
    ou.id as department_id,
    ou.name as department_name,
    COUNT(DISTINCT op.id) as total_projects,
    SUM(CASE WHEN s.name = 'مكتمل' THEN 1 ELSE 0 END) as completed_projects,
    SUM(op.project_cost) as total_budget,
    COALESCE(SUM(muk.actual_value), 0) as total_achievement,
    COALESCE(SUM(pt.target_value), 0) as total_target
FROM 
    organization_units ou
LEFT JOIN operational_projects op ON ou.id = op.organization_unit_id
LEFT JOIN statuses s ON op.status_id = s.id
LEFT JOIN project_kpis pk ON op.id = pk.project_id
LEFT JOIN project_targets pt ON op.id = pt.project_id 
LEFT JOIN monthly_updates mu ON op.id = mu.project_id AND (mu.reporting_year = pt.year AND mu.reporting_month = pt.month)
LEFT JOIN monthly_update_kpis muk ON mu.id = muk.update_id AND pk.id = muk.project_kpi_id
GROUP BY 
    ou.id, ou.name;

-- 3. Strategy Progress Rollup View
-- Rolls up progress from projects up to the goal level
CREATE OR REPLACE VIEW vw_strategy_progress AS
SELECT 
    sg.id as goal_id,
    sg.code as goal_code,
    sg.name as goal_name,
    so.id as objective_id,
    so.code as objective_code,
    so.name as objective_name,
    si.id as initiative_id,
    si.code as initiative_code,
    si.name as initiative_name,
    COUNT(DISTINCT op.id) as project_count,
    SUM(op.project_cost) as total_initiative_budget
FROM 
    strategic_goals sg
LEFT JOIN strategic_objectives so ON sg.id = so.strategic_goal_id
LEFT JOIN strategic_initiatives si ON so.id = si.strategic_objective_id
LEFT JOIN operational_projects op ON si.id = op.initiative_id
GROUP BY 
    sg.id, sg.code, sg.name, 
    so.id, so.code, so.name, 
    si.id, si.code, si.name;

-- 4. Late KPIs View
CREATE OR REPLACE VIEW vw_late_kpis AS
SELECT 
    k.id as kpi_id,
    k.name as kpi_name,
    pk.id as project_kpi_id,
    op.id as project_id,
    op.project_name as project_name,
    ou.name as department_name,
    pt.target_value,
    muk.actual_value,
    s.name as project_status
FROM project_kpis pk
JOIN kpis k ON pk.kpi_id = k.id
JOIN operational_projects op ON pk.project_id = op.id
JOIN organization_units ou ON op.organization_unit_id = ou.id
LEFT JOIN statuses s ON op.status_id = s.id
JOIN project_targets pt ON op.id = pt.project_id
JOIN monthly_updates mu ON op.id = mu.project_id AND mu.reporting_year = pt.year AND mu.reporting_month = pt.month
JOIN monthly_update_kpis muk ON mu.id = muk.update_id AND pk.id = muk.project_kpi_id
WHERE muk.actual_value < pt.target_value;
