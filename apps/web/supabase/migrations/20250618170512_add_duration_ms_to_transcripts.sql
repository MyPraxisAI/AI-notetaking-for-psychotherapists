CREATE OR REPLACE FUNCTION public.get_last_segment_end_ms(content_json jsonb)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN content_json IS NULL THEN NULL
    WHEN content_json->'segments' IS NULL THEN NULL
    WHEN jsonb_array_length(content_json->'segments') = 0 THEN NULL
    ELSE (content_json->'segments'->-1->>'end_ms')::integer
  END;
$$;

-- Add a regular column
ALTER TABLE transcripts ADD COLUMN duration_ms INTEGER;

-- Create a trigger function
CREATE OR REPLACE FUNCTION update_transcript_duration()
RETURNS TRIGGER AS $$
BEGIN
  NEW.duration_ms := get_last_segment_end_ms(NEW.content_json);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_update_transcript_duration
  BEFORE INSERT OR UPDATE OF content_json ON transcripts
  FOR EACH ROW
  EXECUTE FUNCTION update_transcript_duration();

-- Update existing rows
UPDATE transcripts SET duration_ms = get_last_segment_end_ms(content_json);