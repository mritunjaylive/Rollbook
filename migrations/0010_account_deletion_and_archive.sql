CREATE TABLE IF NOT EXISTS deleted_user_archives (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  college_name TEXT,
  student_id TEXT,
  total_semesters INTEGER NOT NULL DEFAULT 0,
  total_subjects INTEGER NOT NULL DEFAULT 0,
  total_periods_logged INTEGER NOT NULL DEFAULT 0,
  overall_attendance_percent INTEGER NOT NULL DEFAULT 0,
  snapshot_data JSONB NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS deleted_archives_user_id_idx ON deleted_user_archives (user_id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS scheduled_deletion_date TIMESTAMPTZ;
