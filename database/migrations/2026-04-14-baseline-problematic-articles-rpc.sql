-- BASELINE (NO APLICAR): definición actual de get_user_problematic_articles_weekly
-- Capturada el 2026-04-14 desde Supabase via pg_get_functiondef.
-- Archivada para referencia histórica del refactor en project_oposicion_scope_refactor.
-- Bug: no filtra por user_profiles.target_oposicion → cross-oposición (dispute 4e247ddc).
-- Esta RPC se reemplaza por lib/api/notifications/queries.ts en FASE 4 y se DROP en FASE 5.

CREATE OR REPLACE FUNCTION public.get_user_problematic_articles_weekly(user_uuid uuid)
 RETURNS TABLE(
   article_id uuid,
   article_number text,
   law_name text,
   total_attempts integer,
   correct_attempts integer,
   accuracy_percentage numeric,
   last_attempt_date timestamp with time zone,
   recommendation text
 )
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    tq.article_id,
    a.article_number,
    l.short_name as law_name,
    COUNT(*)::integer as total_attempts,
    SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::integer as correct_attempts,
    ROUND(
      (SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100,
      1
    ) as accuracy_percentage,
    MAX(tq.created_at) as last_attempt_date,
    CASE
      WHEN ROUND((SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 1) = 0
        THEN '📚 Repasar teoría urgente'
      WHEN ROUND((SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 1) < 30
        THEN '⚠️ Necesita más práctica'
      WHEN ROUND((SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 1) < 50
        THEN '📖 Repasar conceptos'
      ELSE '👍 Casi dominado'
    END as recommendation
  FROM test_questions tq
  JOIN tests t ON tq.test_id = t.id
  JOIN articles a ON tq.article_id = a.id
  JOIN laws l ON a.law_id = l.id
  WHERE t.user_id = user_uuid
    AND t.is_completed = true
    AND tq.created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND tq.article_id IS NOT NULL
  GROUP BY tq.article_id, a.article_number, l.short_name
  HAVING
    COUNT(*) >= 1
    AND ROUND((SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::numeric / COUNT(*)) * 100, 1) < 60
  ORDER BY
    accuracy_percentage ASC,
    total_attempts DESC
  LIMIT 5;
END;
$function$;
