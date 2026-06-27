-- Add target date and recurrence columns to goals table
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS recurrence_rule text,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES goals(id) ON DELETE SET NULL;

-- Create index for efficient recurring goal lookups
CREATE INDEX IF NOT EXISTS idx_goals_recurrence_parent ON goals(recurrence_parent_id)
  WHERE recurrence_parent_id IS NOT NULL;

-- Create index for efficient target_date sorting
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON goals(user_id, completed, target_date);
