-- 20260602_seo_keyword_tracking.sql
-- Seguimiento SEO: keywords objetivo + histórico de posición (de GSC) + bitácora
-- de acciones. Objetivo: medir progreso en el tiempo y CORRELACIONAR acción→ranking
-- (p.ej. "arreglamos H1 el 02/06 → 'ebep' empieza a rankear el 20/06") para
-- encontrar patrones de lo que funciona.
--
-- Origen: análisis competidor testdeley.com (02/06/2026) + auditoría técnica SEO.
-- Doc: docs/roadmap/seo-keywords-competidores.md
--
-- AGNÓSTICO A SUPABASE (migración a AWS/RDS en curso):
--   - Solo Postgres estándar (tablas + índices + RLS). Válido en RDS.
--   - SIN función RPC, SIN auth.uid(), SIN grants a authenticated/anon.
--   - Las posiciones las rellena un cron que lee GSC y escribe vía Drizzle
--     (getAdminDb). El control de acceso está en la capa de aplicación.
--   - RLS habilitado SIN políticas = lockdown vía PostgREST mientras sigamos en
--     Supabase (solo la conexión privilegiada de Drizzle lee/escribe).
--
-- Idempotente. Aplicar en prod solo tras revisión.

-- 1) Catálogo de keywords objetivo (lo mantiene Claude/Manuel).
CREATE TABLE IF NOT EXISTS public.seo_keyword_targets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword             TEXT NOT NULL UNIQUE,
  target_volume       INTEGER,            -- volumen mensual (Semrush u otra fuente)
  search_intent       TEXT,               -- 'commercial' | 'informational' | 'navigational'
  target_slug         TEXT,               -- slug de la página objetivo (p.ej. 'rdl-5-2015')
  target_url          TEXT,               -- URL objetivo completa (opcional)
  priority            TEXT,               -- 'tier1' | 'tier2' | 'tier3'
  competitor          TEXT,               -- p.ej. 'testdeley.com'
  competitor_position NUMERIC,            -- posición del competidor (señal de dificultad)
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.seo_keyword_targets IS
  'Keywords objetivo a rankear (volumen, intención, URL objetivo, prioridad). Catálogo curado.';

CREATE INDEX IF NOT EXISTS idx_seo_targets_priority ON public.seo_keyword_targets (priority);
CREATE INDEX IF NOT EXISTS idx_seo_targets_active   ON public.seo_keyword_targets (is_active);
CREATE INDEX IF NOT EXISTS idx_seo_targets_slug     ON public.seo_keyword_targets (target_slug);

-- 2) Histórico de posición (lo rellena el cron leyendo GSC, ~semanal).
CREATE TABLE IF NOT EXISTS public.seo_keyword_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword     TEXT NOT NULL,
  captured_on DATE NOT NULL,              -- día del snapshot (ventana GSC ~28d terminando aquí)
  position    NUMERIC,                    -- NULL = sin impresiones en GSC (no rankea aún)
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks      INTEGER NOT NULL DEFAULT 0,
  ctr         NUMERIC,
  source      TEXT NOT NULL DEFAULT 'gsc',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (keyword, captured_on)           -- 1 snapshot por keyword y día (índice compuesto)
);

COMMENT ON TABLE public.seo_keyword_snapshots IS
  'Histórico de posición/impresiones por keyword (auto desde GSC). position NULL = no rankea.';

CREATE INDEX IF NOT EXISTS idx_seo_snapshots_keyword ON public.seo_keyword_snapshots (keyword);

-- 3) Bitácora de acciones SEO (la clave para correlacionar causa→efecto).
CREATE TABLE IF NOT EXISTS public.seo_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  done_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  scope_type  TEXT NOT NULL DEFAULT 'global',  -- 'keyword' | 'url' | 'global'
  scope_value TEXT,                            -- keyword o slug afectado (NULL si global)
  action_type TEXT NOT NULL,                   -- 'ssr' | 'h1' | 'title' | 'content' | 'internal_links' | ...
  description TEXT NOT NULL,
  commit_sha  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.seo_actions IS
  'Bitácora de cambios SEO (qué se hizo y cuándo) para correlacionar con movimientos de posición.';

CREATE INDEX IF NOT EXISTS idx_seo_actions_scope ON public.seo_actions (scope_value);
CREATE INDEX IF NOT EXISTS idx_seo_actions_done  ON public.seo_actions (done_on);

-- RLS lockdown: habilitado sin políticas → nadie accede vía PostgREST. La
-- conexión privilegiada de la app (getAdminDb) bypasa RLS. Inocuo en RDS.
ALTER TABLE public.seo_keyword_targets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_keyword_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_actions           ENABLE ROW LEVEL SECURITY;
