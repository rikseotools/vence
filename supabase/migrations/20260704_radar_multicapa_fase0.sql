-- Radar multi-capa — Fase 0
-- 1) Observabilidad total: tabla de ejecuciones por adapter
-- 2) position_group en oposiciones (catalogar TODO, priorizar por grupo)
-- 3) sensor_type 'competitor' en oep_detection_signals (Capa 3)
-- Diseño: docs/roadmap/radar-multicapa.md

-- 1) radar_adapter_runs -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.radar_adapter_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid NOT NULL,
  layer          text NOT NULL,           -- boletin | aggregator | competitor
  adapter_key    text NOT NULL,           -- boe, dogc, oposiciones-es…
  status         text NOT NULL,           -- ok | empty | failed | timeout | skipped
  started_at     timestamptz NOT NULL,
  duration_ms    integer,
  items_scanned  integer NOT NULL DEFAULT 0,
  candidates     integer NOT NULL DEFAULT 0,
  signals_new    integer NOT NULL DEFAULT 0,
  signals_dupe   integer NOT NULL DEFAULT 0,
  http_status    integer,
  error_message  text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_radar_adapter_runs_run    ON public.radar_adapter_runs (run_id);
CREATE INDEX IF NOT EXISTS idx_radar_adapter_runs_key    ON public.radar_adapter_runs (adapter_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_adapter_runs_status ON public.radar_adapter_runs (status, created_at DESC);

COMMENT ON TABLE public.radar_adapter_runs IS
  'Observabilidad del radar multi-capa: un registro por (adapter × pasada). Panel /admin/radar-salud.';

-- 2) oposiciones.position_group ----------------------------------------------
ALTER TABLE public.oposiciones ADD COLUMN IF NOT EXISTS position_group text;
COMMENT ON COLUMN public.oposiciones.position_group IS
  'Grupo funcionarial (A1/A2/B/C1/C2/AP). Catalogar TODO; la prioridad de ejecucion se rige por coverage_level + este grupo, no por exclusion.';

-- 3) sensor_type 'competitor' -------------------------------------------------
ALTER TABLE public.oep_detection_signals
  DROP CONSTRAINT IF EXISTS oep_detection_signals_sensor_type_check;
ALTER TABLE public.oep_detection_signals
  ADD CONSTRAINT oep_detection_signals_sensor_type_check
  CHECK (sensor_type = ANY (ARRAY[
    'llm_semantic','timeline_silence','hash_change','regional_scan','rss',
    'boe_api','google_cse','manual','generic_source','pag_empleo','competitor'
  ]));
