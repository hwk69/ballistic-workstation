-- Add data JSONB column to shots table for dynamic measurement fields
ALTER TABLE shots ADD COLUMN IF NOT EXISTS data JSONB;

-- Backfill existing shots: populate data from dedicated columns
UPDATE shots SET data = jsonb_build_object(
  'fps', fps, 'x', x, 'y', y, 'weight', weight
) WHERE data IS NULL;

-- Add fields JSONB column to app_settings for default field definitions
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS fields JSONB;
