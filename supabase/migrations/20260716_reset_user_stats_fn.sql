-- 20260716_reset_user_stats_fn.sql
-- Reseteo de estadísticas de un usuario CONSERVANDO su cuenta.
--
-- MOTIVACIÓN (caso Ja Fe, feedback 046fe384, 16/07/2026): un usuario que el
-- primer día trastea tests en modo `avanzado` de leyes que aún no ha estudiado,
-- falla casi todo y los abandona, queda marcado PARA SIEMPRE: user_article_stats
-- es acumulado de por vida (accuracy = correct/total, sin ventana ni decay), así
-- que su perfil muestra un muro de artículos "débiles" que es ruido de una tarde
-- de curiosidad — y encima alimenta las recomendaciones de "practica tus débiles".
-- Pidió "empezar de 0 sin eliminar la cuenta". No existía forma de hacerlo.
--
-- DIFERENCIA CON delete_user_account(): aquí user_profiles SOBREVIVE. Eso cambia
-- dos cosas y son las que justifican que esto sea una función y no ~12 DELETE
-- desde la app:
--
--   1. ORDEN OBLIGATORIO. Los triggers materializadores de test_questions tienen
--      un guard `EXISTS user_profiles`. Como el perfil sigue vivo, si se borran
--      las stats ANTES que test_questions, los DELETE de test_questions las
--      REPUEBLAN. Por eso: test_questions/tests primero → stats después.
--      (Mismo razonamiento que delete_user_account §2.)
--
--   2. ATOMICIDAD. La lección del incidente 25/06: N DELETE secuenciales sin
--      transacción sobre el pooler → 504 CloudFront + estado PARCIAL. Aquí un
--      parcial dejaría al usuario con stats descuadradas respecto a sus tests
--      (peor que no haber tocado nada). Una transacción, un round-trip.
--
-- NO se barre dinámicamente por information_schema (a diferencia del borrado
-- RGPD): ahí el objetivo es "que no quede nada", aquí es "borrar SOLO las
-- métricas". Un barrido automático se llevaría por delante el feedback, la
-- atribución de marketing y las preferencias. La lista es explícita a propósito.
--
-- AGNOSTICISMO (docs/roadmap/agnosticismo-supabase.md): PL/pgSQL plano, portable
-- a RDS/Aurora/Neon. Se invoca por Drizzle (getAdminDb().execute(sql`SELECT ...`)),
-- nunca por supabase.rpc().

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Audit trail + snapshot (marcha atrás)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- El reset es irreversible por naturaleza. Antes de borrar, la función vuelca las
-- filas a `snapshot` (JSONB). Motivo doble:
--   - Deshacer: un reset por error (userId equivocado) o un usuario arrepentido
--     se puede reconstruir desde aquí. Sin esto, la única salida sería un PITR de
--     la base entera para rescatar ~600 filas: desproporcionado.
--   - Rastro: el endpoint borra datos de CUALQUIER usuario con solo un userId.
--     Queda quién lo pidió, cuándo y por qué.
--
-- ON DELETE SET NULL en user_id: si la cuenta se borra después (RGPD), el audit
-- sobrevive sin bloquear el borrado. El snapshot es de métricas de estudio, no
-- de datos con retención legal (los pagos NO se tocan aquí).

CREATE TABLE IF NOT EXISTS public.user_stats_resets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  user_email      text,                 -- durable: sobrevive al borrado del perfil
  requested_by    text NOT NULL,        -- email del admin (whitelist requireAdmin)
  reason          text NOT NULL,        -- p.ej. 'petición usuario, feedback 046fe384'
  deleted_counts  jsonb NOT NULL,       -- {tabla: n} — lo que se borró
  snapshot        jsonb,                -- filas completas, para deshacer
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_resets_user
  ON public.user_stats_resets (user_id, created_at DESC);

COMMENT ON TABLE public.user_stats_resets IS
  'Audit + snapshot de cada reseteo de estadísticas (reset_user_stats). Permite deshacer y saber quién lo autorizó.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. reset_user_stats(user_id, requested_by, reason, include_analytics)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Devuelve JSONB {tabla: filas_borradas, _reset_id: uuid}.
--
-- include_analytics = false (default): NO toca user_interactions/user_sessions.
-- Son analítica interna de journey (lo que permite diagnosticar a un usuario en
-- soporte), no lo que él ve en su perfil, y no ensucian sus métricas. En true se
-- borran también, para cuando "todos mis datos" deba interpretarse en sentido
-- amplio.

CREATE OR REPLACE FUNCTION public.reset_user_stats(
  p_user_id           uuid,
  p_requested_by      text,
  p_reason            text,
  p_include_analytics boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_counts    jsonb := '{}'::jsonb;
  v_snapshot  jsonb := '{}'::jsonb;
  v_email     text;
  v_reset_id  uuid;
  v_tbl       text;
  v_n         integer;
  v_rows      jsonb;

  -- ORDEN CRÍTICO (ver cabecera §1): las fuentes ANTES que las derivadas.
  -- test_questions dispara los triggers que decrementan las 5 stats; borrarlas
  -- después limpia cualquier repueblo. Invertir el orden deja stats resucitadas.
  --
  -- test_questions_outbox VA AQUÍ, y no es opcional (bug real, reset de Ja Fe
  -- 16/07): `tg_test_questions_emit_outbox` encola UN EVENTO POR FILA borrada, y
  -- el outbox-processor (backend ECS, asíncrono) los replica DESPUÉS del commit
  -- → reescribe las filas de stats que esta función acababa de borrar. La
  -- transacción no protege de esto: el processor es otro proceso, actúa después.
  -- Purgar los eventos en la MISMA transacción es lo que cierra la carrera (al
  -- commit ya no existen, así que no hay nada que replicar). delete_user_account()
  -- no sufría el bug porque su barrido dinámico se llevaba el outbox de rebote.
  c_source_tables  text[] := ARRAY['test_questions', 'tests', 'test_questions_outbox'];

  c_stats_tables   text[] := ARRAY[
    'user_stats_summary',
    'user_article_stats',      -- el muro rojo: la razón de existir de esta función
    'user_daily_stats',
    'user_difficulty_stats',
    'user_hourly_stats',
    'user_question_history_v2',
    'question_first_attempts',
    'law_question_first_attempts',
    'user_learning_analytics',
    'user_progress',
    'user_streaks'
  ];

  -- Cadáveres del cutover del outbox (tablas reales renombradas, ya no las lee la
  -- app). Se limpian igualmente: si algún día se revirtiera el cutover, las stats
  -- viejas resucitarían y el "empezar de 0" del usuario se desharía solo.
  c_shadow_tables  text[] := ARRAY[
    'user_stats_summary_pre_outbox',
    'user_article_stats_pre_outbox',
    'user_daily_stats_pre_outbox',
    'user_difficulty_stats_pre_outbox',
    'user_hourly_stats_pre_outbox',
    'user_question_history_v2_pre_outbox',
    'question_first_attempts_pre_outbox',
    'law_question_first_attempts_pre_outbox'
  ];

  c_analytics_tables text[] := ARRAY['user_interactions', 'user_sessions'];

  v_all_tables text[];
BEGIN
  -- Guard: el perfil debe existir. Sin esto, un userId inventado devolvería
  -- "todo 0 borrado" y parecería un éxito.
  SELECT email INTO v_email FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reset_user_stats: no existe user_profiles con id=%', p_user_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF coalesce(trim(p_requested_by), '') = '' OR coalesce(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'reset_user_stats: requested_by y reason son obligatorios (audit trail)'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_all_tables := c_source_tables || c_stats_tables || c_shadow_tables;
  IF p_include_analytics THEN
    v_all_tables := v_all_tables || c_analytics_tables;
  END IF;

  -- ── Snapshot ANTES de borrar (marcha atrás) ────────────────────────────────
  -- to_jsonb(t.*) preserva la fila entera sin listar columnas → sobrevive a
  -- futuros ALTER TABLE sin mantenimiento.
  FOREACH v_tbl IN ARRAY v_all_tables LOOP
    IF to_regclass('public.' || v_tbl) IS NULL THEN
      CONTINUE;  -- tabla no existe en este entorno (p.ej. shadow ya dropeada)
    END IF;

    EXECUTE format(
      'SELECT coalesce(jsonb_agg(to_jsonb(t.*)), ''[]''::jsonb) FROM public.%I t WHERE t.user_id = $1',
      v_tbl
    ) INTO v_rows USING p_user_id;

    IF jsonb_array_length(v_rows) > 0 THEN
      v_snapshot := v_snapshot || jsonb_build_object(v_tbl, v_rows);
    END IF;
  END LOOP;

  -- ── Borrado, en orden ──────────────────────────────────────────────────────
  FOREACH v_tbl IN ARRAY v_all_tables LOOP
    IF to_regclass('public.' || v_tbl) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', v_tbl) USING p_user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT;

    IF v_n > 0 THEN
      v_counts := v_counts || jsonb_build_object(v_tbl, v_n);
    END IF;
  END LOOP;

  -- ── Audit ──────────────────────────────────────────────────────────────────
  INSERT INTO public.user_stats_resets
    (user_id, user_email, requested_by, reason, deleted_counts, snapshot)
  VALUES
    (p_user_id, v_email, p_requested_by, p_reason, v_counts, v_snapshot)
  RETURNING id INTO v_reset_id;

  RETURN v_counts || jsonb_build_object('_reset_id', v_reset_id);
END;
$$;

COMMENT ON FUNCTION public.reset_user_stats(uuid, text, text, boolean) IS
  'Resetea las métricas de estudio de un usuario conservando su cuenta. Atómica, con snapshot en user_stats_resets. Orden test_questions/tests → stats (los triggers repueblan si se invierte).';
