-- Add full_professional_name column to therapists table
ALTER TABLE public.therapists 
ADD COLUMN full_professional_name VARCHAR(255);

-- Add comment for the new column
COMMENT ON COLUMN public.therapists.full_professional_name IS 'Full professional name of the therapist, including titles and credentials';

