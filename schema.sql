-- =====================================================================
-- Schema: الخطة التشغيلية المحدثة الأخيرة (Operational Plan)
-- Reverse-engineered 1:1 from actual workbook inspection (8 sheets).
-- Target: PostgreSQL-compatible DDL (works on MySQL 8+/SQL Server with
-- minor type substitutions noted inline).
-- Design notes:
--   * Hierarchy = strategic_goal (1 per sheet) -> sub_goal -> initiative
--     -> operational_project -> project_kpi -> kpi_monthly_tracking
--   * Every "target" style field is stored as TEXT alongside a nullable
--     NUMERIC mirror, because the source file mixes numbers and free
--     text in the same logical column (documented anomaly, see report
--     section 7). This preserves the raw value while allowing numeric
--     queries where the value happens to be numeric.
--   * No formulas exist in the source workbook; nothing here is derived.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS operational_plan;
SET search_path TO operational_plan;

-- ---------------------------------------------------------------------
-- 1) Sheet-level metadata (documents which of the 3 real column layouts
--    a given sheet used, since import logic must branch on this).
-- ---------------------------------------------------------------------
CREATE TABLE sheet_meta (
    sheet_id            SMALLINT PRIMARY KEY,          -- 1..8
    sheet_name          TEXT NOT NULL UNIQUE,           -- literal Arabic sheet name
    column_variant       TEXT NOT NULL CHECK (column_variant IN ('variant_A','variant_B','variant_C')),
    max_row             INTEGER NOT NULL,
    max_col             INTEGER NOT NULL,
    has_execution_cost_column BOOLEAN NOT NULL,         -- FALSE only for variant_A (sheet 1)
    has_baseline_column       BOOLEAN NOT NULL,         -- FALSE only for variant_C (sheet 4)
    budget_is_split_two_cols  BOOLEAN NOT NULL,          -- TRUE only for variant_A (sheet 1)
    department_header_literal TEXT NOT NULL              -- 'الإدارة / القسم' or 'القطاع / الإدارة'
);

-- ---------------------------------------------------------------------
-- 2) Strategic Goal  (column A — one per sheet, merged across all rows)
-- ---------------------------------------------------------------------
CREATE TABLE strategic_goals (
    goal_id       SERIAL PRIMARY KEY,
    sheet_id      SMALLINT NOT NULL REFERENCES sheet_meta(sheet_id),
    goal_name     TEXT NOT NULL,          -- literal 'الهدف الاستراتيجي'
    UNIQUE (sheet_id)                      -- exactly one goal per sheet, per observed data
);

-- ---------------------------------------------------------------------
-- 3) Sub-Goal  (column B — merged block within a goal)
-- ---------------------------------------------------------------------
CREATE TABLE sub_goals (
    sub_goal_id   SERIAL PRIMARY KEY,
    goal_id       INTEGER NOT NULL REFERENCES strategic_goals(goal_id),
    sub_goal_name TEXT NOT NULL,          -- literal 'الهدف الفرعي'
    source_row_start INTEGER NOT NULL,     -- first physical row of the merge range (for traceability)
    source_row_end   INTEGER NOT NULL
);

-- ---------------------------------------------------------------------
-- 4) Strategic Initiative (column C, plus attribute columns D-N which are
--    merged over the SAME row range as C in the observed data)
-- ---------------------------------------------------------------------
CREATE TABLE initiatives (
    initiative_id        SERIAL PRIMARY KEY,
    sub_goal_id          INTEGER NOT NULL REFERENCES sub_goals(sub_goal_id),
    initiative_name       TEXT NOT NULL,   -- literal 'المبادرة الاستراتيجية ' (note trailing space in source header)

    efficiency_kpi_name        TEXT,        -- 'مؤشر الكفاءة للمبادرة (أداة لقياس مدخلات المبادرة)'
    efficiency_target_raw      TEXT,        -- verbatim cell content ('المستهدف' col E)
    efficiency_target_numeric  NUMERIC,     -- NULL if efficiency_target_raw is not parseable as a number (documented anomaly)

    effectiveness_kpi_name       TEXT,      -- 'مؤشر الفعالية للمبادرة (أداة لقياس نتائج المبادرة)'
    effectiveness_target_raw     TEXT,      -- verbatim cell content ('المستهدف' col G)
    effectiveness_target_numeric NUMERIC,

    department_raw        TEXT,             -- verbatim cell; may contain '\n'-joined multiple department names (see sheet 6 row 16 anomaly)

    -- Budget: variant_B/C use a single numeric column; variant_A (sheet 1)
    -- splits it into two raw columns (I, J) whose content is inconsistent
    -- (sometimes numeric, sometimes a location label like 'مكة'/'المدينة').
    budget_single_numeric        NUMERIC,    -- populated for variant_B / variant_C rows
    budget_col_I_raw             TEXT,       -- populated for variant_A rows; verbatim, may be text or number-as-text
    budget_col_J_raw             TEXT,       -- populated for variant_A rows; verbatim, may be text, number-as-text, or NULL

    timeframe_text         TEXT,             -- 'النطاق الزمني لتنفيذ المبادرة', e.g. '26 أسبوع' — free text, NOT parsed into a number here

    source_row_start        INTEGER NOT NULL,
    source_row_end          INTEGER NOT NULL
);

-- ---------------------------------------------------------------------
-- 5) Quarter execution flags (4 columns: الربع 1..4)
-- ---------------------------------------------------------------------
CREATE TABLE initiative_quarters (
    initiative_id   INTEGER NOT NULL REFERENCES initiatives(initiative_id),
    quarter_number  SMALLINT NOT NULL CHECK (quarter_number BETWEEN 1 AND 4),
    raw_glyph       TEXT,       -- verbatim glyph as stored: '✔︎' / '✔' / '✓' / NULL
    is_active       BOOLEAN NOT NULL, -- normalized: TRUE if raw_glyph is any non-null checkmark variant
    PRIMARY KEY (initiative_id, quarter_number)
);

-- ---------------------------------------------------------------------
-- 6) Operational Project (column O in variant_B/C, column P in variant_A)
-- ---------------------------------------------------------------------
CREATE TABLE operational_projects (
    project_id          SERIAL PRIMARY KEY,
    initiative_id       INTEGER NOT NULL REFERENCES initiatives(initiative_id),
    project_name        TEXT NOT NULL,   -- 'المشاريع التشغيلية للمبادرة'; may be '\n'-joined name + parenthetical detail
    execution_cost      NUMERIC,          -- 'تكلفة التنفيذ'; ALWAYS NULL for sheet 1 (variant_A has no such column at all)
    source_row_start    INTEGER NOT NULL,
    source_row_end      INTEGER NOT NULL
);

-- ---------------------------------------------------------------------
-- 7) Project KPI (finest granularity, one un-merged row per KPI)
-- ---------------------------------------------------------------------
CREATE TABLE project_kpis (
    kpi_id              SERIAL PRIMARY KEY,
    project_id          INTEGER NOT NULL REFERENCES operational_projects(project_id),
    kpi_name            TEXT NOT NULL,   -- 'مؤشر القياس'; may be '\n'-joined (e.g. name + date range, see sheet 8 anomalies)
    kpi_target_raw       TEXT,            -- verbatim ('المستهدف' col R / Q)
    kpi_target_numeric   NUMERIC,
    baseline_2025_raw     TEXT,           -- 'خط الأساس المنجز في 2025'; column DOES NOT EXIST for sheet 4 rows -> always NULL there
    baseline_2025_numeric NUMERIC,
    source_row           INTEGER NOT NULL  -- exact physical row number in the sheet
);

-- ---------------------------------------------------------------------
-- 8) Monthly tracking (12 months x 4 sub-fields per KPI row)
-- ---------------------------------------------------------------------
CREATE TABLE kpi_monthly_tracking (
    kpi_id          INTEGER NOT NULL REFERENCES project_kpis(kpi_id),
    month_number    SMALLINT NOT NULL CHECK (month_number BETWEEN 1 AND 12), -- 1=يناير .. 12=ديسمبر
    target_raw      TEXT,     -- 'المستهدف ' (note trailing space in most month blocks); ANOMALY: sometimes non-numeric codes like '6M','5M' (sheets 5, 8)
    target_numeric  NUMERIC,
    achieved_raw    TEXT,     -- 'المنجز'
    achieved_numeric NUMERIC,
    challenges      TEXT,     -- 'التحديات'; a non-breaking-space (U+00A0) placeholder was observed in sheet 1 instead of true NULL — normalize at load time
    evidence        TEXT,     -- 'الشواهد'
    PRIMARY KEY (kpi_id, month_number)
);

-- ---------------------------------------------------------------------
-- 9) Reference table: month numbers to literal Arabic labels used in file
-- ---------------------------------------------------------------------
CREATE TABLE month_labels (
    month_number SMALLINT PRIMARY KEY,
    month_name_ar TEXT NOT NULL
);
INSERT INTO month_labels (month_number, month_name_ar) VALUES
 (1,'يناير'),(2,'فبراير'),(3,'مارس'),(4,'أبريل'),(5,'مايو'),(6,'يونيو'),
 (7,'يوليه'),(8,'أغسطس'),(9,'سبتمبر'),(10,'أكتوبر'),(11,'نوفمبر'),(12,'ديسمبر');

-- ---------------------------------------------------------------------
-- 10) Documented anomalies log (so the import pipeline records every
--     case it had to route to raw_/mixed-type fields, for manual review)
-- ---------------------------------------------------------------------
CREATE TABLE import_anomalies (
    anomaly_id     SERIAL PRIMARY KEY,
    sheet_name     TEXT NOT NULL,
    cell_ref       TEXT NOT NULL,      -- e.g. 'H16', 'G4'
    anomaly_type   TEXT NOT NULL,      -- e.g. 'mixed_type_target', 'multi_value_cell', 'checkmark_glyph_variant', 'nbsp_placeholder', 'budget_split_text'
    raw_value      TEXT,
    note           TEXT
);

-- =====================================================================
-- Indexes for common lookups
-- =====================================================================
CREATE INDEX idx_sub_goals_goal ON sub_goals(goal_id);
CREATE INDEX idx_initiatives_subgoal ON initiatives(sub_goal_id);
CREATE INDEX idx_projects_initiative ON operational_projects(initiative_id);
CREATE INDEX idx_kpis_project ON project_kpis(project_id);
CREATE INDEX idx_monthly_kpi ON kpi_monthly_tracking(kpi_id);
