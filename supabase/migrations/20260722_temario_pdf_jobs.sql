-- 20260722_temario_pdf_jobs.sql
--
-- Capa 1 de la generación robusta de PDFs del temario: la COLA de trabajos.
--
-- Principio: la generación se DESACOPLA del serving. El render pesado de @react-pdf bloquea el
-- event loop de la task que sirve tráfico → deja de responder health checks → la matan antes de
-- terminar (motivo real de que T18/T19 no se pre-generaran; exit 137 = "failed health checks", NO
-- OOM). Solución: un WORKER dedicado (fuera del ALB, sin health checks) consume esta cola,
-- renderiza sin prisa, sube a la caché S3 (content-addressed) y marca el trabajo. La descarga sirve
-- siempre de S3 → nunca window.print.
--
-- content_hash = topicPdfContentHash(content) (mismo que la key de S3). Al cambiar el contenido
-- cambia el hash → nuevo trabajo → auto-regeneración. Un solo trabajo VIVO por (oposicion,tema,hash).

CREATE TABLE IF NOT EXISTS temario_pdf_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oposicion     text NOT NULL,
  tema          integer NOT NULL,
  content_hash  text NOT NULL,
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'done', 'failed')),
  attempts      integer NOT NULL DEFAULT 0,
  last_error    text,
  bytes         integer,
  ms            integer,
  claimed_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Idempotencia del encolado: a lo sumo UN trabajo VIVO (pending/running) por (oposicion, tema,
-- content_hash). Reencolar el mismo contenido no crea duplicados (INSERT ... ON CONFLICT DO NOTHING).
CREATE UNIQUE INDEX IF NOT EXISTS temario_pdf_jobs_alive_uq
  ON temario_pdf_jobs (oposicion, tema, content_hash)
  WHERE status IN ('pending', 'running');

-- Claim del worker: coge el más antiguo pendiente con FOR UPDATE SKIP LOCKED.
CREATE INDEX IF NOT EXISTS temario_pdf_jobs_pending
  ON temario_pdf_jobs (created_at)
  WHERE status = 'pending';

-- Retriaje de trabajos colgados (worker muerto a media faena): un 'running' con claimed_at viejo
-- se puede devolver a 'pending'. Índice para ese barrido.
CREATE INDEX IF NOT EXISTS temario_pdf_jobs_running
  ON temario_pdf_jobs (claimed_at)
  WHERE status = 'running';
