-- Sprint A del roadmap docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md
--
-- Convertir la tabla `oposiciones` en la única fuente de verdad del catálogo.
-- Antes: 45 implementadas en BD + 138 aspiracionales en OFFICIAL_OPOSICIONES
-- hardcoded en components/OnboardingModal.tsx. Modelo dicotómico que crea
-- ciudadanos de segunda clase.
--
-- Después: una sola tabla con `coverage_level` que refleja la etapa actual
-- de elaboración. El sistema multi-sensor + Lambda headless vigila TODAS.
-- Auto-promoción cuando se detectan condiciones objetivas.
--
-- Esta migración solo añade DDL. Los inserts masivos de las 138 aspiracionales
-- van en script Node separado (scripts/migrate-official-oposiciones-to-bd.cjs)
-- por la complejidad de parsear OnboardingModal.tsx.

-- ============================================================
-- 1) Columnas nuevas
-- ============================================================

ALTER TABLE public.oposiciones
  ADD COLUMN IF NOT EXISTS coverage_level TEXT NOT NULL DEFAULT 'catalogada'
    CHECK (coverage_level IN (
      'catalogada',       -- mínimos: nombre, slug, categoria, administracion, seguimiento_url
      'monitorizada',     -- + plazas, fechas, hitos extraídos automáticamente
      'con_temario',      -- + topic_scope + topics con epígrafes (≥5)
      'con_tests',        -- + ≥50 preguntas vinculadas vía topic_scope
      'con_landing',      -- + landing dinámica (FAQs + estadísticas + examen_config)
      'full'              -- + frontend dedicado, branding, integración profunda
    ));

ALTER TABLE public.oposiciones
  ADD COLUMN IF NOT EXISTS fetcher_type TEXT NOT NULL DEFAULT 'http'
    CHECK (fetcher_type IN ('http', 'headless', 'pdf', 'rss', 'boe_api'));

ALTER TABLE public.oposiciones
  ADD COLUMN IF NOT EXISTS headless_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.oposiciones
  ADD COLUMN IF NOT EXISTS demand_score INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.oposiciones.coverage_level IS
  'Etapa de elaboración de la oposición. Auto-promoción vía cron auto-promote-coverage. Ver docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md';

COMMENT ON COLUMN public.oposiciones.fetcher_type IS
  'Tipo de fetcher para seguimiento_url. http = fetch nativo. headless = AWS Lambda Playwright. pdf = extractor PDF. rss = parser RSS. boe_api = API estructurada BOE.';

COMMENT ON COLUMN public.oposiciones.headless_required IS
  'Atajo del audit Fase 0: true si seguimiento_url es JS-rendered y solo el cron con Lambda headless puede detectarla. Cuando se setea, fetcher_type debe ir a "headless".';

COMMENT ON COLUMN public.oposiciones.demand_score IS
  'COUNT(*) FROM user_profiles WHERE target_oposicion = slug. Refrescado por cron auto-promote-coverage. NULL = pendiente de calcular.';

-- ============================================================
-- 2) Tabla coverage_history para auditoría de saltos de nivel
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coverage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oposicion_id UUID NOT NULL REFERENCES public.oposiciones(id) ON DELETE CASCADE,
  from_level TEXT NOT NULL,
  to_level TEXT NOT NULL,
  reason TEXT NOT NULL,             -- ej. 'topic_scope_count_>=5', 'questions_count_>=50', 'manual_admin', 'llm_extracted_data'
  changed_by TEXT NOT NULL,         -- 'system' | 'cron_auto_promote' | email del admin
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT NULL       -- contexto adicional (ej. {trigger_count: 7, threshold: 5})
);

CREATE INDEX IF NOT EXISTS idx_coverage_history_oposicion_at
  ON public.coverage_history(oposicion_id, changed_at DESC);

COMMENT ON TABLE public.coverage_history IS
  'Audit append-only de saltos de coverage_level. Permite medir SLAs (tiempo medio catalogada→monitorizada, etc.). Ver docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md §2.';

-- ============================================================
-- 3) Backfill coverage_level para las 45 oposiciones existentes
--
-- Heurística basada en datos actuales:
--   * full: tiene frontend dedicado (app/<slug>/). Se evalúa manualmente más tarde.
--   * con_landing: landing_faqs + landing_estadisticas + examen_config no nulos.
--   * con_tests: ≥50 preguntas vinculadas via topic_scope (calcular).
--   * con_temario: ≥5 topics activos para position_type.
--   * monitorizada: tiene convocatoria_fecha o exam_date o plazas_libres.
--   * catalogada: resto.
--
-- Como las 45 actuales tienen contenido implementado, la mayoría caen en
-- con_landing o con_tests. Esta migración aplica el subset que puede inferir
-- desde columnas de oposiciones; los upgrades a con_temario+ los hace el cron
-- de Sprint D (que sabe contar topics + preguntas).
-- ============================================================

-- Paso 3a: monitorizada (al menos tiene datos del proceso)
UPDATE public.oposiciones
SET coverage_level = 'monitorizada'
WHERE coverage_level = 'catalogada'
  AND (
    convocatoria_fecha IS NOT NULL
    OR exam_date IS NOT NULL
    OR plazas_libres IS NOT NULL
  );

-- Paso 3b: con_landing (tiene los 3 JSONB principales)
UPDATE public.oposiciones
SET coverage_level = 'con_landing'
WHERE coverage_level = 'monitorizada'
  AND landing_faqs IS NOT NULL
  AND jsonb_array_length(landing_faqs) >= 3
  AND landing_estadisticas IS NOT NULL
  AND jsonb_array_length(landing_estadisticas) >= 3
  AND examen_config IS NOT NULL
  AND examen_config != '{}'::jsonb;

-- Los upgrades a con_temario, con_tests y full requieren querying de otras
-- tablas (topics, questions, app/<slug>/). Los hace el cron Sprint D.

-- ============================================================
-- 4) Histórico inicial: registrar el backfill como un salto manual
-- ============================================================

INSERT INTO public.coverage_history (oposicion_id, from_level, to_level, reason, changed_by, metadata)
SELECT
  id,
  'catalogada' AS from_level,
  coverage_level AS to_level,
  'sprint_a_backfill' AS reason,
  'system' AS changed_by,
  jsonb_build_object('migration', '20260601_oposiciones_coverage_level') AS metadata
FROM public.oposiciones
WHERE coverage_level != 'catalogada';

-- ============================================================
-- 5) Constraint: si fetcher_type = 'headless', headless_required debe ser true
--    (y viceversa: ayuda a mantener consistencia)
-- ============================================================

ALTER TABLE public.oposiciones
  ADD CONSTRAINT chk_fetcher_headless_consistency
  CHECK (
    (fetcher_type = 'headless' AND headless_required = true)
    OR (fetcher_type != 'headless')
  );

-- ============================================================
-- ROLLBACK (descomentar si hace falta revertir)
-- ============================================================
-- ALTER TABLE public.oposiciones DROP CONSTRAINT IF EXISTS chk_fetcher_headless_consistency;
-- DROP TABLE IF EXISTS public.coverage_history;
-- ALTER TABLE public.oposiciones DROP COLUMN IF EXISTS demand_score;
-- ALTER TABLE public.oposiciones DROP COLUMN IF EXISTS headless_required;
-- ALTER TABLE public.oposiciones DROP COLUMN IF EXISTS fetcher_type;
-- ALTER TABLE public.oposiciones DROP COLUMN IF EXISTS coverage_level;
