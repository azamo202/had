-- =============================================================
-- Fix notifications table to match frontend expectations
-- =============================================================

-- 1. Drop old notifications table and recreate with correct schema
DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,           -- e.g. 'approval_pending', 'update_approved', 'update_rejected'
    title       TEXT NOT NULL,
    body        TEXT DEFAULT '',
    entity_id   UUID,                    -- optional link to monthly_update id
    project_id  UUID,                    -- optional link to project id
    read        BOOLEAN DEFAULT false,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Index for fast lookup by user
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);

-- 3. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Users can only READ their own notifications
CREATE POLICY "Users can read own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Any authenticated user can INSERT a notification (needed so strategy manager
-- can notify the department rep and vice versa)
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Users can UPDATE (mark as read) only their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Users can DELETE their own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- 5. Enable Realtime on notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
