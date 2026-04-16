-- Add share_token UUID column to comparisons table
ALTER TABLE comparisons ADD COLUMN IF NOT EXISTS share_token UUID;

-- Unique partial index — only non-null tokens must be unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_comparisons_share_token
  ON comparisons(share_token) WHERE share_token IS NOT NULL;

-- RPC function: returns all data needed for a shared view.
-- Uses SECURITY DEFINER so anonymous callers bypass RLS.
-- This is a single-user setup (no user_id scoping needed).
CREATE OR REPLACE FUNCTION get_shared_data(token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comp RECORD;
  result JSON;
BEGIN
  -- Find the comparison by share token
  SELECT * INTO comp FROM comparisons WHERE share_token = token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired share link';
  END IF;

  -- Return comparison + all sessions + all shots + all attachments + settings
  SELECT json_build_object(
    'comparison', row_to_json(comp),
    'sessions', (
      SELECT COALESCE(json_agg(s ORDER BY s.created_at DESC), '[]'::json)
      FROM sessions s
    ),
    'shots', (
      SELECT COALESCE(json_agg(sh), '[]'::json)
      FROM shots sh
    ),
    'attachments', (
      SELECT COALESCE(json_agg(a), '[]'::json)
      FROM attachments a
    ),
    'settings', (
      SELECT row_to_json(st)
      FROM app_settings st WHERE st.id = 1
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Allow unauthenticated (anon) callers to invoke this function
GRANT EXECUTE ON FUNCTION get_shared_data(UUID) TO anon;
