-- 20260626_delete_user_account_fn.sql
--
-- Borrado RGPD de cuentas en UNA sola transacción server-side.
--
-- MOTIVACIÓN (incidente 2026-06-25): el endpoint /api/admin/delete-user hacía
-- ~52 DELETE secuenciales (un round-trip por tabla) sin transacción global.
-- Sobre el pooler remoto se pasaba de los 30s del edge → 504 CloudFront, y como
-- cada DELETE autocommiteaba, el borrado quedaba PARCIAL (datos fuera, perfil +
-- auth vivos). Reintentar la API era peligroso: re-archivaba 0 pagos y machacaba
-- el archivo legal. Ver docs/maintenance/eliminacion-cuentas.md §6.
--
-- ESTA FUNCIÓN lo arregla de raíz:
--   - 1 round-trip → borrado set-based dentro de la BD → sub-segundo, sin 504.
--   - Atómica por construcción (una transacción) → nunca estado parcial.
--   - Idempotente: archiva el pago SOLO si archived_data IS NULL → reintentar es
--     seguro, imposible destruir el archivo legal.
--   - Barrido dinámico por information_schema → cubre TODA tabla public con
--     user_id (mata la clase de bug "lista de tablas incompleta").
--
-- AGNOSTICISMO (docs/roadmap/agnosticismo-supabase.md):
--   - PL/pgSQL plano = Postgres puro, portable a RDS/Aurora/Neon (el roadmap
--     clasifica triggers/funciones Postgres como "agnóstico de Supabase").
--   - NO toca auth.* : la identidad (auth.users) la sigue borrando el endpoint
--     por el puerto authAdmin (Fase 4). Esta función borra SOLO schema public.
--   - Sin session_replication_role (necesitaría superuser, no portable): se
--     respeta el ORDEN de borrado y el guard EXISTS user_profiles de los triggers
--     materializadores, igual que el código de app anterior.
--   - Se invoca por Drizzle (getAdminDb().execute(sql`SELECT delete_user_account`)),
--     nunca por supabase.rpc().

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived  jsonb;
  v_payments  jsonb;
  v_tbl       text;
BEGIN
  -- 0. Guard: el perfil debe existir (idempotencia + sanity).
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_profiles % not found', p_user_id USING ERRCODE = 'no_data_found';
  END IF;

  -- 1. ARCHIVADO LEGAL (Art. 17.3.b RGPD + Art. 30 CdC), idempotente.
  --    Solo se archiva si aún no hay archivo: así un reintento NUNCA sobrescribe
  --    el archived_data con un set vacío (los pagos ya borrados).
  SELECT archived_data INTO v_archived
  FROM public.deleted_users_log
  WHERE original_user_id = p_user_id;

  IF v_archived IS NULL OR NOT (v_archived ? 'tables') THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(ps.*)), '[]'::jsonb) INTO v_payments
    FROM public.payment_settlements ps
    WHERE ps.user_id = p_user_id;

    v_archived := jsonb_build_object(
      'archived_at', now(),
      'tables', jsonb_build_object('payment_settlements', v_payments)
    );

    UPDATE public.deleted_users_log
    SET archived_data = v_archived
    WHERE original_user_id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'deleted_users_log row for % is missing — insert it (with deletion_reason) before calling delete_user_account', p_user_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;
  END IF;

  -- 2. Tablas SENSIBLES A TRIGGERS materializadores, en orden:
  --    test_questions/tests primero (disparan los UPSERT a las 5 stats), luego
  --    las stats (limpian el repueblo). Mientras user_profiles exista el guard
  --    de los triggers permite el repueblo; por eso se limpian DESPUÉS aquí, y
  --    no quedan test_questions que vuelvan a dispararlos más adelante.
  DELETE FROM public.test_questions       WHERE user_id = p_user_id;
  DELETE FROM public.tests                WHERE user_id = p_user_id;
  DELETE FROM public.user_stats_summary   WHERE user_id = p_user_id;
  DELETE FROM public.user_article_stats   WHERE user_id = p_user_id;
  DELETE FROM public.user_daily_stats     WHERE user_id = p_user_id;
  DELETE FROM public.user_difficulty_stats WHERE user_id = p_user_id;
  DELETE FROM public.user_hourly_stats    WHERE user_id = p_user_id;

  -- 3. payment_settlements: ya archivado en (1) → borrar.
  DELETE FROM public.payment_settlements  WHERE user_id = p_user_id;

  -- 4. BARRIDO DINÁMICO: toda tabla BASE de public con columna user_id que no se
  --    haya tratado ya. Cubre outbox, *_pre_outbox, observable_events, rollout
  --    logs, etc. — y cualquier tabla FUTURA — sin mantener listas a mano.
  FOR v_tbl IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name   = c.table_name
     AND t.table_type   = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name  = 'user_id'
      AND c.table_name NOT IN (
        'test_questions','tests','user_stats_summary','user_article_stats',
        'user_daily_stats','user_difficulty_stats','user_hourly_stats',
        'payment_settlements','deleted_users_log','user_profiles'
      )
  LOOP
    EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_tbl) USING p_user_id;
  END LOOP;

  -- 5. Tablas donde el SUJETO se referencia por otra columna (no user_id).
  DELETE FROM public.feedback_messages WHERE sender_id = p_user_id;

  -- 6. Finalmente user_profiles → CASCADE limpia las ~11 tablas hijas restantes.
  --    test_questions ya está vacío, así que la cascada no re-dispara stats.
  DELETE FROM public.user_profiles WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'archived', v_archived);
END;
$$;

COMMENT ON FUNCTION public.delete_user_account(uuid) IS
  'Borrado RGPD atómico de una cuenta (schema public). Archiva pagos en '
  'deleted_users_log.archived_data de forma idempotente, borra todas las tablas '
  'public con user_id (barrido dinámico) en una transacción. NO toca auth.users '
  '(eso lo hace el endpoint via el puerto authAdmin). El caller debe haber '
  'insertado antes la fila de deleted_users_log con el deletion_reason. '
  'Ver docs/maintenance/eliminacion-cuentas.md.';

REVOKE EXECUTE ON FUNCTION public.delete_user_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO service_role;

COMMIT;
