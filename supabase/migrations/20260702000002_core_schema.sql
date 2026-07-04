-- Core Schema

CREATE TABLE organization_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES organization_units(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- e.g., 'Department', 'Section'
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    organization_unit_id UUID REFERENCES organization_units(id) ON DELETE SET NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE strategic_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE strategic_objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategic_goal_id UUID NOT NULL REFERENCES strategic_goals(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    sort_order INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE strategic_initiatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategic_objective_id UUID NOT NULL REFERENCES strategic_objectives(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    efficiency_kpi_id UUID REFERENCES kpis(id) ON DELETE SET NULL,
    effectiveness_kpi_id UUID REFERENCES kpis(id) ON DELETE SET NULL,
    timeline_start DATE,
    timeline_end DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE operational_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    initiative_id UUID NOT NULL REFERENCES strategic_initiatives(id) ON DELETE CASCADE,
    organization_unit_id UUID NOT NULL REFERENCES organization_units(id) ON DELETE RESTRICT,
    project_name TEXT NOT NULL,
    project_cost NUMERIC(15,2),
    baseline TEXT,
    status_id UUID REFERENCES statuses(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (initiative_id, organization_unit_id, project_name)
);

CREATE TABLE project_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES operational_projects(id) ON DELETE CASCADE,
    kpi_id UUID NOT NULL REFERENCES kpis(id) ON DELETE RESTRICT,
    baseline TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (project_id, kpi_id)
);

CREATE TABLE project_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES operational_projects(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    quarter INTEGER,
    month INTEGER,
    target_value NUMERIC(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (project_id, year, month)
);

-- Add Indexes for Foreign Keys
CREATE INDEX idx_org_units_parent ON organization_units(parent_id);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_org ON users(organization_unit_id);
CREATE INDEX idx_strat_obj_goal ON strategic_objectives(strategic_goal_id);
CREATE INDEX idx_strat_init_obj ON strategic_initiatives(strategic_objective_id);
CREATE INDEX idx_op_proj_init ON operational_projects(initiative_id);
CREATE INDEX idx_op_proj_org ON operational_projects(organization_unit_id);
CREATE INDEX idx_proj_kpis_proj ON project_kpis(project_id);
CREATE INDEX idx_proj_targets_proj ON project_targets(project_id);
