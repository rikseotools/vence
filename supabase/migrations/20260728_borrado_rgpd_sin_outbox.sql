-- El borrado RGPD deja de escribir 75.000 filas de outbox para borrarlas él mismo — [T-215]
--
-- ## Medido antes de tocar nada (28/07, simulación con ROLLBACK sobre el usuario más activo)
--
-- `DELETE FROM test_questions WHERE user_id = …` con 75.272 filas: **111,7 s**, contra un
-- `statement_timeout` de 20 s. O sea, a ese usuario no se le puede borrar la cuenta: el endpoint
-- devuelve `success:false` y la cuenta sigue viva. Es RGPD Art. 17, y falla justo con los veteranos
-- y premium — los que más derecho tienen a que funcione.
--
-- El reparto del coste, con `pg_stat_user_functions` (track_functions=pl), no por intuición:
--
--   38,4 s (34%)  tg_test_questions_emit_outbox   75.332 llamadas
--    0,0 s ( 0%)  los 6 triggers de stats         0 llamadas  ← ya estaban DESACTIVADOS
--   ~73  s (66%)  el propio DELETE: 18 índices (3,2 GB) sobre 2,3 GB de datos
--
-- ⚠️ Esto CORRIGE el diagnóstico con el que se abrió la ficha («los 15 triggers materializadores,
-- 500.000 ejecuciones»): 22 de los 26 triggers de `test_questions` están en `tgenabled='D'` y no se
-- ejecutan. El único que cuesta es el del outbox. Las tres vías que la ficha barajaba
-- (`session_replication_role`, `ALTER TABLE DISABLE TRIGGER`, marca de sesión en los 15 guards)
-- apuntaban al trigger equivocado.
--
-- ## Por qué es un no-op semántico, no una optimización arriesgada
--
-- El paso 2 de `delete_user_account()` borra `test_questions` → el trigger escribe una fila de
-- outbox POR CADA UNA, con `to_jsonb(OLD)` duplicado en `payload` y `old_payload`. Y el paso 4 (el
-- barrido dinámico de toda tabla con `user_id`) borra `test_questions_outbox`… en la MISMA
-- transacción. Es decir: se escriben 75.272 filas que nadie llega a leer jamás —el procesador solo
-- ve lo commiteado— y se borran acto seguido. No se está quitando un evento a nadie: se está
-- dejando de fabricar basura.
--
-- Y de paso cierra una incoherencia fea: el outbox guardaba una copia ÍNTEGRA (por duplicado) de las
-- filas de un usuario que ha pedido que le borres los datos. Aunque durase un instante, es
-- exactamente lo que no debe hacer un borrado.
--
-- ## La marca
--
-- `app.deleting_user` la fija `delete_user_account()` con `set_config(..., is_local => true)`: vive
-- SOLO dentro de esa transacción y desaparece con ella. En el tráfico normal el `current_setting`
-- devuelve NULL y el trigger se comporta exactamente igual que antes — por eso no hace falta tocar
-- ningún llamador. Se compara contra el `user_id` de la fila, no es un interruptor global: un
-- borrado no puede callar los eventos de OTRO usuario aunque compartan transacción.
--
-- ## Lo que esto NO arregla (y hay que decirlo)
--
-- Quedan los ~73 s del DELETE en sí, que son mantenimiento de 18 índices. Con el presupuesto de 20 s
-- por sentencia, el usuario más pesado SIGUE sin caber: eso pide otra decisión (subir el timeout de
-- esa ruta concreta o hacer el borrado en segundo plano), y va en la ficha. Esta migración quita el
-- 34% que era trabajo puro para tirar.

BEGIN;

CREATE OR REPLACE FUNCTION public.tg_test_questions_emit_outbox()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- BORRADO RGPD EN CURSO: no se emite nada para las filas de ESE usuario. La marca la pone
  -- `delete_user_account()` y es local a su transacción; el evento que se dejaría de emitir lo
  -- borraría esa misma transacción unas líneas más abajo. Ver la cabecera de esta migración.
  IF TG_OP = 'DELETE'
     AND current_setting('app.deleting_user', true) IS NOT NULL
     AND current_setting('app.deleting_user', true) = OLD.user_id::text THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.test_questions_outbox
      (test_question_id, event_type, payload, user_id)
    VALUES
      (NEW.id, 'INSERT', to_jsonb(NEW), NEW.user_id);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.test_questions_outbox
      (test_question_id, event_type, payload, old_payload, user_id)
    VALUES
      (NEW.id, 'UPDATE', to_jsonb(NEW), to_jsonb(OLD), NEW.user_id);
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.test_questions_outbox
      (test_question_id, event_type, payload, old_payload, user_id)
    VALUES
      (OLD.id, 'DELETE', to_jsonb(OLD), to_jsonb(OLD), OLD.user_id);
    RETURN OLD;

  END IF;
  RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION public.tg_test_questions_emit_outbox() IS
  'Emite el evento de outbox por fila. Se calla durante un borrado RGPD (marca de transacción app.deleting_user = user_id): esos eventos los borraba la propia transacción del borrado sin que nadie los leyera, y costaban 38 s de los 111 s que hacían imposible borrar la cuenta de un usuario activo (T-215).';

COMMIT;

-- ── La otra mitad: la función del borrado fija la marca ─────────────────────────────────────
-- Se reescribe ENTERA (volcada de producción con pg_get_functiondef y con una sola línea añadida
-- en el paso 0.bis) para que el fichero sea la verdad completa de lo que queda en la BD.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_archived  jsonb;
  v_payments  jsonb;
  v_tbl       text;
BEGIN
  -- 0.bis. MARCA DE BORRADO, local a esta transacción (desaparece con ella, commit o rollback).
  --        La lee `tg_test_questions_emit_outbox` para NO fabricar una fila de outbox por cada
  --        `test_question` que se borra aquí: son eventos que el paso 4 borraría acto seguido, sin
  --        que ningún consumidor llegara a verlos (solo se lee lo commiteado). Medido el 28/07 sobre
  --        el usuario más activo: 38,4 s de los 111,7 s del borrado, tirados. [T-215]
  PERFORM set_config('app.deleting_user', p_user_id::text, true);

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
$function$
;

COMMIT;
