-- 20260727_user_feedback_timestamptz.sql
--
-- `user_feedback` era la ÚNICA tabla del recorrido de un usuario con sus fechas en
-- `timestamp WITHOUT time zone`. Las demás del mismo cruce (`user_interactions`, `email_events`,
-- `feedback_messages`, `tests`, `user_profiles`) son `timestamptz`, así que comparar unas con
-- otras producía un desfase FANTASMA de 2 h en verano (1 h en invierno): el valor guardado es
-- correcto —UTC—, pero al leerlo sin zona el cliente lo interpreta como hora de Madrid.
--
-- ## Por qué importa (no es cosmético)
--
-- El runbook de eliminación de cuentas OBLIGA a reconstruir el "journey del día de la solicitud"
-- cruzando `user_feedback` con `user_interactions`, y ese cruce salía falseado. Ya costó dos
-- diagnósticos equivocados:
--   · T-103 (26/07): se dio por hecho que `user_profiles.created_at` "se reseteaba" y que había
--     "bajas fantasma" anteriores al alta. No era cierto — era este desfase. Una sesión entera
--     persiguiendo un write que no existe.
--   · 27/07: un `account_deletion` cuya solicitud figuraba DOS HORAS ANTES del propio registro
--     del usuario. El `deletion_reason` habría quedado mal para siempre (el log sobrevive al
--     borrado).
--
-- Y la tabla era incoherente CONSIGO MISMA: `claimed_at` —añadida después, por el sistema de
-- reparto de la cola— ya es `timestamptz`. Comparar `claimed_at` con `created_at` dentro de la
-- MISMA fila daba el desfase. Verificado el 27/07: de las 8 tablas del cruce del journey
-- (`user_interactions`, `email_events`, `feedback_messages`, `tests`, `user_profiles`,
-- `notification_events`, `test_questions`), `user_feedback` era la ÚNICA con columnas naive.
--
-- ## Por qué la conversión es EXACTA y no mueve ningún dato
--
-- Las tres columnas tienen `DEFAULT now()` y el servidor corre en UTC, así que el valor naive YA
-- es hora UTC. Verificado contra los datos reales (27/07/2026) antes de escribir esto: en los 8
-- feedbacks más recientes, la diferencia entre `created_at` y la interacción `timestamptz` más
-- cercana del mismo usuario —comparada AT TIME ZONE 'UTC'— es de 0 minutos. Si el naive fuera
-- hora local, ahí habría 120 minutos.
--
-- `AT TIME ZONE 'UTC'` sobre un `timestamp` naive significa "este valor ES UTC" y devuelve el
-- `timestamptz` equivalente. NO desplaza el instante: solo lo etiqueta.
--
-- ## Seguridad de la operación (comprobado en RDS el 27/07/2026)
--
-- 746 filas / 1 MB. Sin vistas, reglas, triggers ni columnas generadas que dependan de la tabla.
-- El único índice sobre una columna afectada es `idx_uf_claim` (parcial, sobre `created_at`), que
-- Postgres reconstruye solo dentro del mismo ALTER. Reversible: el `USING x AT TIME ZONE 'UTC'`
-- inverso devuelve exactamente el valor anterior.
--
-- Consumidores: `db/schema.ts` (hay que poner `withTimezone: true` en las tres) y el trinquete
-- `__tests__/guardrails/timestampTimezone.guardrail.test.ts`, del que hay que RETIRAR estas tres
-- entradas de `DEUDA_CONOCIDA` — la lista solo puede menguar. Quedan 10 columnas naive.

BEGIN;

ALTER TABLE public.user_feedback
  ALTER COLUMN created_at  TYPE timestamptz USING created_at  AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at  TYPE timestamptz USING updated_at  AT TIME ZONE 'UTC',
  ALTER COLUMN resolved_at TYPE timestamptz USING resolved_at AT TIME ZONE 'UTC';

-- Los DEFAULT now() sobreviven al cambio de tipo, pero se reafirman para que queden explícitos
-- (ahora `now()` devuelve timestamptz, que es justo lo que queremos almacenar).
ALTER TABLE public.user_feedback
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET DEFAULT now();

COMMIT;
