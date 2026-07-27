-- Rollup diario de preguntas SERVIDAS por sujeto (usuario / IP / dispositivo).
--
-- Origen 27/07/2026 (auditoría anti-scraping). El sistema medía el consumo por
-- `daily_question_usage.questions_answered`, es decir por respuestas GUARDADAS.
-- Pero la cosecha de un banco de preguntas no responde: carga y se va. Resultado:
-- todo lo que mira "consumo" estaba ciego al modo real de scraping.
--
-- Caso que lo demuestra (usuario anferbar987, 16/05/2026): `daily_question_usage`
-- contó **2** preguntas ese día; se le sirvieron **5.495**. Por el mismo agujero,
-- el detector `curl_scraping` de `scripts/fraud-sweep.cjs` —que también se apoya en
-- respuestas— no ha disparado ni una vez en toda la vida de la tabla.
--
-- YA EXISTÍA un contador de servidas: `recordServedForSubjects()`
-- (lib/security/challengePolicy/questionsServed.ts) incrementa claves Redis
-- `captcha:served:<sujeto>:<YYYYMMDD>` con TTL 26 h, y alimenta el gate de captcha.
-- Esta tabla NO es un contador nuevo ni una taxonomía nueva: es ese mismo contador,
-- con los mismos sujetos, hecho DURADERO y consultable por SQL. Hacía falta porque
-- `fraud-sweep.cjs` corre en GitHub Actions (fuera de la VPC) y no puede leer
-- ElastiCache; sin esto, los detectores no tienen forma de ver lo servido.
--
-- Encaja además con lo que ya dice `TelemetryRetentionService`: "para histórico a
-- largo plazo, la vía es un rollup diario".
--
-- CRECIMIENTO Y RETENCIÓN: es un ROLLUP, no un firehose — una fila por sujeto y
-- día. Con ~300 usuarios activos/día (medido 07/2026) y 2-3 sujetos por usuario
-- salen ~1.000 filas/día ≈ 365 k filas (~30 MB) al año. NO se engancha a
-- `TelemetryRetentionService` (que purga observable_events/validation_error_logs a
-- 30 d) a propósito: ese servicio no tiene tests y no compensa tocar el purgado de
-- una tabla de 10 M filas por una que tardará años en molestar. Cuando toque, la
-- poda es directa gracias a `idx_dqs_date`:
--   DELETE FROM daily_questions_served WHERE usage_date < CURRENT_DATE - 365;
--
-- Idempotente (IF NOT EXISTS): se puede re-aplicar sin efecto.

CREATE TABLE IF NOT EXISTS public.daily_questions_served (
  -- Clave del sujeto, IDÉNTICA a la de Redis para que ambos lados sean el mismo
  -- concepto: uuid del usuario en crudo, `ip:<ip>` o `device:<id>`.
  -- Deliberadamente SIN FK a user_profiles: un sujeto puede ser una IP o un
  -- dispositivo anónimo, y perder la fila al borrar un usuario destruiría
  -- justamente la evidencia que esta tabla existe para conservar.
  subject_key  text    NOT NULL,
  -- Derivado de subject_key, materializado para filtrar barato ('user'|'ip'|'device').
  subject_kind text    NOT NULL,
  usage_date   date    NOT NULL,
  served       integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_questions_served_pkey PRIMARY KEY (subject_key, usage_date),
  CONSTRAINT daily_questions_served_kind_chk CHECK (subject_kind IN ('user', 'ip', 'device')),
  CONSTRAINT daily_questions_served_nonneg_chk CHECK (served >= 0)
);

COMMENT ON TABLE public.daily_questions_served IS
  'Rollup diario de preguntas SERVIDAS por sujeto (usuario/IP/dispositivo). Espejo duradero del contador Redis captcha:served:* que alimenta el gate anti-scraping. Complementa daily_question_usage (que cuenta RESPONDIDAS): servidas >> respondidas es la firma de cosecha. Creada 27/07/2026.';

COMMENT ON COLUMN public.daily_questions_served.subject_key IS
  'Misma clave que Redis: uuid del usuario en crudo, ip:<ip> o device:<id>. Sin FK a propósito (puede no ser un usuario, y la evidencia debe sobrevivir al borrado de la cuenta).';

-- Barrido por fecha: lo que hacen los detectores (ventanas de 7-30 d) y la poda.
CREATE INDEX IF NOT EXISTS idx_dqs_date
  ON public.daily_questions_served (usage_date DESC);

-- "Los mayores consumidores de los últimos N días", por tipo de sujeto.
CREATE INDEX IF NOT EXISTS idx_dqs_kind_date_served
  ON public.daily_questions_served (subject_kind, usage_date DESC, served DESC);
