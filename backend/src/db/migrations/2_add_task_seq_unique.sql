-- Add UNIQUE constraint on (project_id, seq) to prevent duplicate seq within a project.
-- This provides a DB-level safety net for the race-safe seq generation in create_task.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_project_id_seq ON tasks(project_id, seq);
