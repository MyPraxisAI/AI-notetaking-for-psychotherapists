-- Created at: 2025-05-08 12:48:00

/*
 * -------------------------------------------------------
 * Section: Add content_json column to transcripts table
 * -------------------------------------------------------
 */

-- Add content_json column to transcripts table
ALTER TABLE public.transcripts 
ADD COLUMN content_json JSONB;

-- Add comment to the column
COMMENT ON COLUMN public.transcripts.content_json IS 'Structured transcript content with segments containing start/end timestamps, speaker, and content';

-- Create a function to validate the JSON schema for content_json
CREATE OR REPLACE FUNCTION validate_transcript_content_json_schema(data jsonb)
RETURNS boolean AS $$
BEGIN
  RETURN jsonb_schema_valid(
    '{
      "type": "object",
      "required": ["segments"],
      "properties": {
        "segments": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["start", "end", "speaker", "content"],
            "properties": {
              "start": {"type": "number", "minimum": 0},
              "end": {"type": "number", "minimum": 0},
              "speaker": {"type": "string", "enum": ["therapist", "client"]},
              "content": {"type": "string"}
            }
          }
        }
      }
    }',
    data
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add constraint to validate the JSON schema
ALTER TABLE public.transcripts
ADD CONSTRAINT validate_content_json_schema
CHECK (
  content_json IS NULL OR validate_transcript_content_json_schema(content_json)
);

