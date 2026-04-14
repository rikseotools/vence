-- Tabla para monitorizar el despliegue gradual del path nuevo de
-- artículos problemáticos (ver docs/maintenance/despliegue-articulos-problematicos.md).
-- Se escribe fire-and-forget desde el endpoint; no bloquea la respuesta.
-- Borrar tras cleanup de FASE 5 (cuando el path viejo ya no existe).

CREATE TABLE IF NOT EXISTS public.problematic_articles_rollout_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid,
  position_type   text,
  path            text NOT NULL CHECK (path IN ('new', 'old')),
  articles_count  integer NOT NULL DEFAULT 0,
  law_names       text[] DEFAULT '{}',
  duration_ms     integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_par_logs_created_at
  ON public.problematic_articles_rollout_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_par_logs_path_created
  ON public.problematic_articles_rollout_logs (path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_par_logs_zero_count
  ON public.problematic_articles_rollout_logs (created_at DESC)
  WHERE articles_count = 0;

-- RLS: solo service_role escribe/lee. Admin lee via endpoint con requireAdmin.
ALTER TABLE public.problematic_articles_rollout_logs ENABLE ROW LEVEL SECURITY;
