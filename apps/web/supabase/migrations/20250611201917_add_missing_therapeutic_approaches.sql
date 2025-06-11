-- Migration to add missing therapeutic approaches
-- Created on: 2025-06-11

-- Based on the full list comparison, the following approaches are being added:

-- Add Rational Emotive Behavior Therapy (REBT)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('c1111111-1111-4111-c111-111111111111', 'rebt', 'Rational Emotive Behavior Therapy (REBT)', now(), now());

-- Add Schema Therapy
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('c2222222-2222-4222-c222-222222222222', 'schema', 'Schema Therapy', now(), now());

-- Add Behavioral Activation
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('c3333333-3333-4333-c333-333333333333', 'ba', 'Behavioral Activation', now(), now());

-- Add Compassion-Focused Therapy (CFT)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('c4444444-4444-4444-c444-444444444444', 'cft', 'Compassion-Focused Therapy (CFT)', now(), now());

-- Add Mindfulness-Based Stress Reduction (MBSR)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('c5555555-5555-4555-c555-555555555555', 'mbsr', 'Mindfulness-Based Stress Reduction (MBSR)', now(), now());

-- Add Mentalization-Based Therapy (MBT)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('c6666666-6666-4666-c666-666666666666', 'mbt', 'Mentalization-Based Therapy (MBT)', now(), now());

-- Add Transference-Focused Psychotherapy (TFP)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('c7777777-7777-4777-c777-777777777777', 'tfp', 'Transference-Focused Psychotherapy (TFP)', now(), now());

-- Add Prolonged Exposure Therapy (PE)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('c8888888-8888-4888-c888-888888888888', 'pe', 'Prolonged Exposure Therapy (PE)', now(), now());

-- Add Cognitive Processing Therapy (CPT)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('c9999999-9999-4999-c999-999999999999', 'cpt', 'Cognitive Processing Therapy (CPT)', now(), now());

-- Add Somatic Experiencing (SE)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('d1111111-1111-4111-d111-111111111111', 'se', 'Somatic Experiencing (SE)', now(), now());

-- Add Sensorimotor Psychotherapy
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('d2222222-2222-4222-d222-222222222222', 'sensorimotor', 'Sensorimotor Psychotherapy', now(), now());

-- Add Brainspotting
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('d3333333-3333-4333-d333-333333333333', 'brainspotting', 'Brainspotting', now(), now());

-- Add Logotherapy (Existential Therapy)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('d4444444-4444-4444-d444-444444444444', 'logotherapy', 'Logotherapy (Existential Therapy)', now(), now());

-- Add Focusing
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('d5555555-5555-4555-d555-555555555555', 'focusing', 'Focusing', now(), now());

-- Add Psychodrama
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('d6666666-6666-4666-d666-666666666666', 'psychodrama', 'Psychodrama', now(), now());

-- Add Transactional Analysis (TA)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('d7777777-7777-4777-d777-777777777777', 'ta', 'Transactional Analysis (TA)', now(), now());

-- Add Art Therapy
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('d8888888-8888-4888-d888-888888888888', 'art', 'Art Therapy', now(), now());

-- Add Music Therapy
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('d9999999-9999-4999-d999-999999999999', 'music', 'Music Therapy', now(), now());

-- Add Gottman Method Couples Therapy
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('e1111111-1111-4111-e111-111111111111', 'gottman', 'Gottman Method Couples Therapy', now(), now());

-- Add Bowen Family Systems Therapy
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('e2222222-2222-4222-e222-222222222222', 'bowen', 'Bowen Family Systems Therapy', now(), now());

-- Add Process-Oriented Psychology (Process Work)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('e3333333-3333-4333-e333-333333333333', 'process', 'Process-Oriented Psychology (Process Work)', now(), now());

-- Add Cognitive-Behavioral Coaching (CBC)
INSERT INTO public.therapeutic_approaches (id, name, title, created_at, updated_at)
VALUES ('e4444444-4444-4444-e444-444444444444', 'cbc', 'Cognitive-Behavioral Coaching (CBC)', now(), now());
