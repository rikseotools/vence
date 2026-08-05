-- T-486 — el rol de coordinación puede RECLAMAR una impugnación, y nada más.
--
-- ── POR QUÉ, Y QUÉ LO DESTAPÓ ───────────────────────────────────────────────────────────────
-- Se les encargó a dos trabajadores analizar una impugnación y dejar el borrador. Los dos se
-- pararon y diagnosticaron lo mismo, con la medición hecha: `cola.cjs next` muere con
-- `42501 permission denied for table question_disputes`. El claim de esa cola hace
-- `UPDATE … SET claimed_by, claimed_at`, y **ningún** rol de la flota puede escribir ahí:
-- `vence_coordinacion` no tiene la tabla, y `vence_lector` es solo SELECT.
--
-- Hicieron bien en pararse en vez de rodearlo (uno propuso explícitamente NO usar el rol de
-- lectura para «reclamar sin claim atómico»). El encargo estaba mal dado: se comprobó que podían
-- LEER la impugnación y no que pudieran COGERLA.
--
-- ── LA LÍNEA, Y POR QUÉ ES POR COLUMNAS ─────────────────────────────────────────────────────
-- Reclamar una fila de una cola es un acto de COORDINACIÓN —lo mismo que `backlog_tasks`— y por eso
-- va al rol de coordinación. Pero estas dos tablas no son solo cola: llevan el texto de la
-- impugnación, el veredicto y la respuesta que se le manda a una persona.
--
-- Así que el permiso se da **por columnas**: `UPDATE (claimed_by, claimed_at)` y nada más. Postgres
-- lo hace cumplir; no es una promesa de comportamiento. Un trabajador puede coger su sitio en la
-- cola y soltarlo, y **no puede** tocar el estado, el veredicto ni la respuesta — que es justo lo
-- que sigue siendo de una persona (`lib/sessions/aprobacion.cjs`).
--
-- El SELECT no se concede aquí: ya lo tiene `vence_lector`, que es con quien se lee el contenido.
-- Dos credenciales para dos cosas distintas, como el resto de la flota.
--
-- Idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vence_coordinacion') THEN
    RAISE EXCEPTION 'falta el rol vence_coordinacion (migración 20260804_rol_coordinacion_flota.sql)';
  END IF;
END $$;

-- Ver la cola para elegir: sin esto el `SELECT … FOR UPDATE SKIP LOCKED` del claim no puede correr.
GRANT SELECT ON public.question_disputes TO vence_coordinacion;
GRANT SELECT ON public.psychometric_question_disputes TO vence_coordinacion;

-- Y coger sitio. SOLO estas dos columnas.
GRANT UPDATE (claimed_by, claimed_at) ON public.question_disputes TO vence_coordinacion;
GRANT UPDATE (claimed_by, claimed_at) ON public.psychometric_question_disputes TO vence_coordinacion;

-- El supuesto se AFIRMA en vez de darse por hecho: si mañana alguien concede la tabla entera, este
-- fichero dejaría de describir lo que pasa.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
    FROM information_schema.role_table_grants
   WHERE grantee = 'vence_coordinacion'
     AND table_name IN ('question_disputes', 'psychometric_question_disputes')
     AND privilege_type IN ('INSERT', 'DELETE', 'TRUNCATE');
  IF n > 0 THEN
    RAISE EXCEPTION 'vence_coordinacion tiene % privilegio(s) de escritura de FILA sobre las impugnaciones: el alcance ya no es el declarado (T-486)', n;
  END IF;
END $$;
