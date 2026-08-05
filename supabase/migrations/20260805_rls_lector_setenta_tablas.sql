-- T-573 / T-574 — `vence_lector`: el GRANT de T-486 no bastaba, y bloqueaba EN SILENCIO.
--
-- ── EL FALLO, MEDIDO ─────────────────────────────────────────────────────────────────────────
-- `20260805_rol_lector_flota.sql` hizo `GRANT SELECT ON ALL TABLES IN SCHEMA public TO
-- vence_lector` y luego REVOCÓ una a una las que llevan un identificador directo. Eso deja el
-- privilegio de TABLA correcto. Pero el privilegio de tabla es solo la mitad: si la tabla tiene
-- RLS activado (`ENABLE ROW LEVEL SECURITY`) y CERO políticas que mencionen a `vence_lector` (ni
-- por su nombre ni por PUBLIC), el motor no da un error — filtra TODAS las filas y devuelve un
-- resultado vacío. `SELECT 1 FROM tests LIMIT 1` no lanza excepción: simplemente no hay nada.
-- Es el mismo fallo que ya se vio y arregló para `question_disputes`/`psychometric_question_disputes`
-- (`20260805_rls_impugnaciones_flota.sql`, T-486/T-574) — aquí es el resto del catálogo.
--
-- Medido el 05/08 contra la BD real, conectando COMO `vence_lector` y preguntándole al propio
-- catálogo (`has_table_privilege(current_user, …)` + `pg_policies` filtrando por `roles`, no solo
-- por «¿existe alguna política?» — una tabla puede tener política para `authenticated` o
-- `service_role` y seguir sin dar nada a `vence_lector`): **80 tablas** con el GRANT concedido,
-- RLS activo, y ninguna política que alcance a este rol. Entre ellas `tests` y `test_questions`,
-- que es justo lo que dejó a medias la re-verificación de [T-472] (`sim-repaso-ajeno.ts`, nota de
-- acceso del 05/08).
--
-- ── EL ALCANCE ───────────────────────────────────────────────────────────────────────────────
-- Solo se añade política a tablas que YA tenían el GRANT SELECT de T-486 — es decir, tablas que el
-- autor de esa migración ya decidió que no llevan identificador directo. Esta migración no cambia
-- esa frontera, solo hace efectivo el permiso que ya existía sobre el papel. Las tablas de la lista
-- REVOKE de T-486 (`user_profiles`, `payment_settlements`, `user_sessions`…) siguen sin GRANT y
-- por tanto sin necesitar política: ahí el motor sigue negando con 42501 (error real, no silencio).
--
-- Política de solo LECTURA (`FOR SELECT … USING (true)`, sin filtro por fila: este rol no tiene
-- noción de "fila propia", lee actividad agregada por `user_id`, que es un UUID). Ninguna de estas
-- 80 tablas concede escritura a `vence_lector` — eso lo sigue impidiendo el GRANT de T-486, que
-- nunca dio INSERT/UPDATE/DELETE.
--
-- Idempotente (DROP POLICY IF EXISTS antes de crear).

DO $$
DECLARE
  t text;
  tablas text[] := ARRAY[
    'ai_api_config', 'ai_api_usage', 'ai_chat_logs', 'ai_chat_suggestion_clicks', 'ai_chat_suggestions',
    'ai_chat_traces', 'ai_verification_errors', 'ai_verification_results', 'article_exam_stats',
    'article_update_logs', 'article_versions', 'attribution_touches', 'conversion_outbox',
    'convocatoria_seguimiento_checks', 'custom_oposiciones', 'daily_question_usage', 'detection_sources',
    'email_logs', 'email_preferences', 'email_templates', 'fraud_alerts', 'fraud_watch_list',
    'generic_source_checks', 'law_question_first_attempts_pre_outbox', 'law_versions', 'legal_modifications',
    'notification_logs', 'notification_metrics', 'oep_detection_signals', 'outbox_events',
    'prediction_tracking', 'problematic_articles_rollout_logs', 'problematic_questions_tracking',
    'psychometric_first_attempts', 'psychometric_test_answers', 'psychometric_test_sessions', 'pwa_events',
    'pwa_sessions', 'question_first_attempts_pre_outbox', 'question_lifecycle_history', 'ranking_cache',
    'seo_actions', 'seo_keyword_snapshots', 'seo_keyword_targets', 'session_block_events', 'share_events',
    'spelling_test_answers', 'spelling_test_sessions', 'telegram_alerts', 'telegram_groups',
    'test_configurations', 'test_questions', 'tests', 'trigger_logs', 'upgrade_message_impressions',
    'user_acquisition', 'user_avatar_settings', 'user_devices', 'user_difficulty_metrics',
    'user_inscription_banner_dismissals', 'user_interactions', 'user_interactions_archive',
    'user_learning_analytics', 'user_medals', 'user_message_interactions', 'user_notification_metrics',
    'user_notification_settings', 'user_oposicion_alerts', 'user_progress', 'user_psychometric_preferences',
    'user_recommendations', 'user_roles', 'user_stats_summary_pre_outbox', 'user_streaks_backup_20241208',
    'user_test_favorites', 'user_test_sessions', 'user_video_progress', 'validation_error_logs',
    'verification_queue', 'verification_schedule'
  ];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS flota_lector_lee ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY flota_lector_lee ON public.%I FOR SELECT TO vence_lector USING (true)', t);
    ELSE
      RAISE WARNING 'T-573: tabla % de la lista ya no existe en el catálogo — se omite', t;
    END IF;
  END LOOP;
END $$;

-- ── EL TRINQUETE ─────────────────────────────────────────────────────────────────────────────
-- El fallo original no era «faltan políticas»: era que un GRANT sin política de vence_lector no
-- se nota (0 filas, sin error) y por eso sobrevivió sin que nadie lo viera. Que esta migración
-- cierre las 80 de hoy no impide que la 81 llegue igual de silenciosa. Esta comprobación es la
-- misma consulta que canary-rol-lector.cjs corre en vivo — aquí se afirma en el momento de migrar,
-- que es donde se puede abortar si algo quedó a medias.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
     AND has_table_privilege('vence_lector', c.oid, 'SELECT')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = c.relname
          AND ('vence_lector' = ANY(p.roles) OR p.roles = '{public}')
     );
  IF n > 0 THEN
    RAISE EXCEPTION 'T-573: quedan % tabla(s) con GRANT SELECT a vence_lector, RLS activo y SIN política que lo alcance — bloqueo silencioso sin cerrar', n;
  END IF;
END $$;
