-- Sprint G.1 del roadmap docs/roadmap/sprint-g-oposiciones-vs-convocatorias.md
--
-- Separar `oposiciones` (cuerpo estable) de `convocatorias` (proceso temporal).
-- Modelo anterior: una entrada por convocatoria, duplicación de campos estables,
-- fila huérfana al cambiar año (auxiliar-administrativo-madrid-2025).
-- Modelo nuevo: 1 oposición = 1 cuerpo, N convocatorias = N procesos históricos.

-- ============================================================
-- 0) Renombrar tabla convocatorias preexistente (legacy)
--
-- Existe una tabla `convocatorias` con schema viejo del manual
-- crear-nueva-oposicion.md §2c (12 filas históricas, ningún query en
-- código actualmente la lee — solo se usa `convocatoria_hitos`). Para
-- no perder los datos pero no chocar nombres, se renombra a
-- `convocatorias_legacy` y se crea la tabla nueva limpia.
--
-- Si tras 1 mes no aparece nadie usándola, se DROP en otra migración.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'convocatorias'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'convocatorias' AND column_name = 'is_current'
  ) THEN
    ALTER TABLE public.convocatorias RENAME TO convocatorias_legacy;
    COMMENT ON TABLE public.convocatorias_legacy IS
      'Tabla legacy del schema viejo. Renombrada por Sprint G (2026-06-01). 12 filas históricas. Sin uso en código actual. DROP candidate tras 1 mes.';
  END IF;
END $$;

-- ============================================================
-- 1) Tabla convocatorias (modelo nuevo Sprint G)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.convocatorias (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oposicion_id                    UUID NOT NULL REFERENCES public.oposiciones(id) ON DELETE CASCADE,
  año                             INTEGER NOT NULL,
  convocatoria_numero             TEXT,
  convocatoria_fecha              DATE,
  convocatoria_dogv               TEXT,

  -- Solo una convocatoria por oposicion puede tener is_current=true (trigger abajo).
  is_current                      BOOLEAN NOT NULL DEFAULT false,
  archived_at                     TIMESTAMPTZ,  -- NULL = vigente, fecha = histórica

  estado_proceso                  TEXT,
  oep_decreto                     TEXT,
  oep_fecha                       DATE,

  plazas_libres                   INTEGER,
  plazas_promocion_interna        INTEGER,
  plazas_discapacidad             INTEGER,

  boe_publication_date            DATE,
  boe_reference                   TEXT,

  inscription_start               DATE,
  inscription_deadline            DATE,
  exam_date                       DATE,
  exam_date_approximate           BOOLEAN DEFAULT false,

  programa_url                    TEXT,
  examen_config                   JSONB,
  landing_faqs                    JSONB,
  landing_estadisticas            JSONB,
  landing_description             TEXT,
  requisitos_especiales           JSONB,

  -- Monitorización del seguimiento (cron check-seguimiento)
  seguimiento_last_checked        TIMESTAMPTZ,
  seguimiento_last_hash           TEXT,
  seguimiento_change_status       TEXT,
  seguimiento_change_detected_at  TIMESTAMPTZ,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (oposicion_id, año),
  CHECK (año >= 1970 AND año <= 2100)
);

COMMENT ON TABLE public.convocatorias IS
  'Sprint G del roadmap sprint-g-oposiciones-vs-convocatorias.md. Un proceso selectivo concreto de una oposición. Una oposición tiene N convocatorias (histórico) + 0/1 con is_current=true.';

COMMENT ON COLUMN public.convocatorias.is_current IS
  'Convocatoria vigente del cuerpo. Trigger ensure_single_current_convocatoria garantiza máximo 1 por oposicion_id.';

COMMENT ON COLUMN public.convocatorias.archived_at IS
  'NULL = convocatoria vigente o en curso. Timestamp = convocatoria histórica archivada (proceso terminado).';

-- ============================================================
-- 2) Trigger: invariante is_current único por oposicion
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_single_current_convocatoria()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.convocatorias
    SET is_current = false,
        updated_at = NOW()
    WHERE oposicion_id = NEW.oposicion_id
      AND id != NEW.id
      AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_convocatorias_single_current ON public.convocatorias;
CREATE TRIGGER tg_convocatorias_single_current
AFTER INSERT OR UPDATE OF is_current ON public.convocatorias
FOR EACH ROW
WHEN (NEW.is_current = true)
EXECUTE FUNCTION public.ensure_single_current_convocatoria();

-- ============================================================
-- 3) Índices
-- ============================================================

-- Parcial: solo convocatorias vigentes (90%+ de queries del frontend filtran is_current=true)
CREATE INDEX IF NOT EXISTS idx_convocatorias_oposicion_current
  ON public.convocatorias (oposicion_id)
  WHERE is_current = true;

-- Para banner inscription_open
CREATE INDEX IF NOT EXISTS idx_convocatorias_inscription_open
  ON public.convocatorias (inscription_start, inscription_deadline)
  WHERE estado_proceso = 'inscripcion_abierta';

-- Para queries del cron check-seguimiento (vigentes con URL de seguimiento)
CREATE INDEX IF NOT EXISTS idx_convocatorias_seguimiento
  ON public.convocatorias (oposicion_id)
  WHERE archived_at IS NULL AND programa_url IS NOT NULL;

-- ============================================================
-- 4) convocatoria_hitos: añadir FK a convocatoria
--
-- Mantenemos oposicion_id (legacy) para queries no migradas; el cleanup va en
-- fase G.7. Por ahora ambas columnas conviven.
-- ============================================================

ALTER TABLE public.convocatoria_hitos
  ADD COLUMN IF NOT EXISTS convocatoria_id UUID
  REFERENCES public.convocatorias(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_convocatoria_hitos_convocatoria_id
  ON public.convocatoria_hitos (convocatoria_id, order_index);

COMMENT ON COLUMN public.convocatoria_hitos.convocatoria_id IS
  'Sprint G: hito atado a su convocatoria específica. Backfill en G.2. oposicion_id queda como legacy hasta G.7.';

-- ============================================================
-- 5) updated_at trigger para convocatorias
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_convocatorias_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_convocatorias_touch_updated_at ON public.convocatorias;
CREATE TRIGGER tg_convocatorias_touch_updated_at
BEFORE UPDATE ON public.convocatorias
FOR EACH ROW
EXECUTE FUNCTION public.touch_convocatorias_updated_at();

-- ============================================================
-- ROLLBACK (descomentar si hace falta)
-- ============================================================
-- DROP TRIGGER IF EXISTS tg_convocatorias_touch_updated_at ON public.convocatorias;
-- DROP TRIGGER IF EXISTS tg_convocatorias_single_current ON public.convocatorias;
-- DROP FUNCTION IF EXISTS public.touch_convocatorias_updated_at();
-- DROP FUNCTION IF EXISTS public.ensure_single_current_convocatoria();
-- DROP INDEX IF EXISTS idx_convocatoria_hitos_convocatoria_id;
-- ALTER TABLE public.convocatoria_hitos DROP COLUMN IF EXISTS convocatoria_id;
-- DROP INDEX IF EXISTS idx_convocatorias_seguimiento;
-- DROP INDEX IF EXISTS idx_convocatorias_inscription_open;
-- DROP INDEX IF EXISTS idx_convocatorias_oposicion_current;
-- DROP TABLE IF EXISTS public.convocatorias;
