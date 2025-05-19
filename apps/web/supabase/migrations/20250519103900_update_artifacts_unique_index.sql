-- Drop the existing non-unique index
DROP INDEX IF EXISTS ix_artifacts_reference_type_id_type_language;

-- Create a new unique index on reference_type, reference_id, and type
CREATE UNIQUE INDEX ix_artifacts_reference_type_id_type_unique
ON public.artifacts (reference_type, reference_id, type);

-- Add a comment explaining the purpose of this index
COMMENT ON INDEX public.ix_artifacts_reference_type_id_type_unique IS 
'Ensures uniqueness of artifacts by reference type, reference id, and type, allowing multiple languages per artifact';
