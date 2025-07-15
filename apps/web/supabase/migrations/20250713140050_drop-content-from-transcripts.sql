-- Migration: Drop 'content' column from 'public.transcripts' table
ALTER TABLE public.transcripts DROP COLUMN IF EXISTS content;
