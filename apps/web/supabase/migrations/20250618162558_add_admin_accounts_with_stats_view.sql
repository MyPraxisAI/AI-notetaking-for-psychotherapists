-- Migration: Add admin_accounts_with_stats view
-- Created at: 2025-06-18

CREATE OR REPLACE VIEW public.admin_accounts_with_stats AS
SELECT
  a.*,
  COUNT(DISTINCT s.id) AS sessions_count,
  COALESCE(SUM(t.duration_ms), 0) / 1000 AS sessions_duration_seconds
FROM public.accounts a
LEFT JOIN public.clients c ON c.account_id = a.id AND c.demo = false
LEFT JOIN public.sessions s ON s.client_id = c.id
LEFT JOIN public.transcripts t ON t.session_id = s.id
GROUP BY a.id;

-- Restrict access to service_role only
REVOKE ALL ON public.admin_accounts_with_stats FROM PUBLIC, authenticated;
GRANT SELECT ON public.admin_accounts_with_stats TO service_role;
