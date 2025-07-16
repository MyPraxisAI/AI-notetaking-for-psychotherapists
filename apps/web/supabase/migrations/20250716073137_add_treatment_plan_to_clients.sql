-- Migration: Add treatment_plan column to clients table
ALTER TABLE public.clients
ADD COLUMN treatment_plan TEXT;

COMMENT ON COLUMN public.clients.treatment_plan IS 'The treatment plan for the client, can be null.';
