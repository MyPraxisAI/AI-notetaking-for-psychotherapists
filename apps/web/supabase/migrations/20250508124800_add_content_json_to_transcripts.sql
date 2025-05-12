-- Created at: 2025-05-08 12:48:00

/*
 * -------------------------------------------------------
 * Section: Add content_json column to transcripts table
 * -------------------------------------------------------
 */

-- Add content_json column to transcripts table
ALTER TABLE public.transcripts 
ADD COLUMN content_json JSONB;

-- Add comment explaining the expected structure
COMMENT ON COLUMN public.transcripts.content_json IS 'Structured transcript content with segments array. Each segment should have start_ms, end_ms, speaker ("therapist" or "client"), and content fields.';

-- Create a function to validate the transcript segments structure
CREATE OR REPLACE FUNCTION validate_transcript_segments(data jsonb)
RETURNS boolean AS $$
DECLARE
  segment_count integer;
  segment jsonb;
  segments jsonb;
BEGIN
  -- Check if data is NULL or doesn't have segments property
  IF data IS NULL OR NOT (data ? 'segments') THEN
    RETURN FALSE;
  END IF;
  
  -- Check if segments is an array
  IF jsonb_typeof(data->'segments') != 'array' THEN
    RETURN FALSE;
  END IF;
  
  -- Get segments array
  segments := data->'segments';
  segment_count := jsonb_array_length(segments);
  
  -- If empty array, it's valid
  IF segment_count = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Check each segment for required fields
  FOR i IN 0..(segment_count-1) LOOP
    segment := segments->i;
    
    -- Check if segment is an object
    IF jsonb_typeof(segment) != 'object' THEN
      RETURN FALSE;
    END IF;
    
    -- Check required fields exist
    IF NOT (segment ? 'start_ms' AND segment ? 'end_ms' AND 
            segment ? 'speaker' AND segment ? 'content') THEN
      RETURN FALSE;
    END IF;
    
    -- Check field types
    IF jsonb_typeof(segment->'start_ms') != 'number' OR 
       jsonb_typeof(segment->'end_ms') != 'number' OR
       jsonb_typeof(segment->'speaker') != 'string' OR
       jsonb_typeof(segment->'content') != 'string' THEN
      RETURN FALSE;
    END IF;
    
    -- Check speaker is either 'therapist' or 'client'
    IF (segment->>'speaker') != 'therapist' AND 
       (segment->>'speaker') != 'client' THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraint to validate the content_json structure
ALTER TABLE public.transcripts
ADD CONSTRAINT validate_content_json_structure
CHECK (
  content_json IS NULL OR validate_transcript_segments(content_json)
);


