-- Add unique constraint to ensure chunk_number is unique for a given recording_id
ALTER TABLE public.recordings_chunks 
ADD CONSTRAINT recordings_chunks_recording_id_chunk_number_unique 
UNIQUE (recording_id, chunk_number);

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT recordings_chunks_recording_id_chunk_number_unique 
ON public.recordings_chunks 
IS 'Ensures that chunk_number is unique for each recording_id, preventing duplicate chunk numbers';
