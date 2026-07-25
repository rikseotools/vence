-- 20260726_oep_entidad.sql — F1 de T-108: la OEP como entidad de primer nivel.
--
-- PROBLEMA (medido 25/07): la OEP vive como texto libre `oep_decreto` (60% de las 151 filas con
-- OEP son multi-OEP concatenadas, p.ej. "RD 625/2023, RD 656/2024 y RD 651/2025") + `oep_fecha`
-- UNA sola date. Imposible: representar N OEP con su decreto/fecha/plazas, atribuir plazas por
-- OEP, medir el backlog de OEP sin convocar, ni desambiguar año-OEP vs año-convocatoria.
--
-- DISEÑO (aditivo, CERO pérdida de datos): tablas NUEVAS en paralelo. NO se toca `convocatorias`
-- (sus filas con inscritos/plazas/stats se siguen archivando, no sobrescribiendo, vía rollover).
-- `oep_decreto`/`oep_fecha` se mantienen como legacy poblado (back-compat) hasta F4.
--
-- Detalle y fases: docs/roadmap/oep-entidad-modelo.md

-- ── Entidad OEP (una fila por decreto de OEP que aprueba plazas para una oposición) ───────────
CREATE TABLE IF NOT EXISTS oep (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oposicion_id              uuid NOT NULL REFERENCES oposiciones(id) ON DELETE CASCADE,
  "año_oep"                 integer NOT NULL,           -- año del DECRETO de OEP (≠ año de convocatoria)
  decreto                   text,                       -- "RD 625/2023", "Decreto 12/2026", "OEP 2024"…
  fecha                     date,                       -- fecha del decreto de OEP
  ambito                    text,                       -- 'estatal' | 'autonomico' | 'local'
  plazas_libres             integer,
  plazas_discapacidad       integer,
  plazas_promocion_interna  integer,
  plazas_otros_turnos       jsonb,
  estado                    text NOT NULL DEFAULT 'aprobada',  -- 'aprobada'(backlog) | 'convocada' | 'anulada'
  fuente_url                text,                       -- URL oficial del decreto (BOE/BOR/DOGV/…)
  doc_key                   text,                       -- identidad canónica (canonicalizeBoletinUrl) → hub
  source_documento_id       uuid REFERENCES convocatoria_documentos(id) ON DELETE SET NULL,
  notas                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oep_año_valido    CHECK ("año_oep" >= 1970 AND "año_oep" <= 2100),
  CONSTRAINT oep_estado_valido CHECK (estado = ANY (ARRAY['aprobada','convocada','anulada'])),
  CONSTRAINT oep_ambito_valido CHECK (ambito IS NULL OR ambito = ANY (ARRAY['estatal','autonomico','local']))
);

-- Identidad natural: una OEP por (oposición, año, decreto). Evita duplicar el mismo decreto.
CREATE UNIQUE INDEX IF NOT EXISTS oep_identidad ON oep (oposicion_id, "año_oep", COALESCE(decreto, ''));
CREATE INDEX IF NOT EXISTS oep_oposicion_idx ON oep (oposicion_id);
-- Backlog de OEP sin convocar (estado='aprobada' y sin convocatoria enlazada): consultable.
CREATE INDEX IF NOT EXISTS oep_backlog_idx ON oep (oposicion_id) WHERE estado = 'aprobada';

-- ── Puente N:M convocatoria ↔ oep ─────────────────────────────────────────────────────────────
-- Modela: N OEP → 1 convocatoria (acumulación de OEP pasadas no convocadas) y
--          1 OEP → N convocatorias (turno libre + promoción interna en Órdenes distintas).
CREATE TABLE IF NOT EXISTS convocatoria_oep (
  convocatoria_id   uuid NOT NULL REFERENCES convocatorias(id) ON DELETE CASCADE,
  oep_id            uuid NOT NULL REFERENCES oep(id) ON DELETE CASCADE,
  plazas_aportadas  integer,     -- plazas de ESTA OEP que entran en ESTA convocatoria (si se conoce)
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (convocatoria_id, oep_id)
);
CREATE INDEX IF NOT EXISTS convocatoria_oep_por_oep_idx ON convocatoria_oep (oep_id);

-- ── El hub de documentos ya soporta tipo='oep_decreto'; añadimos el enlace inverso a la OEP ────
ALTER TABLE convocatoria_documentos ADD COLUMN IF NOT EXISTS oep_id uuid REFERENCES oep(id) ON DELETE SET NULL;
-- y ampliamos la `fuente` con los orígenes de clonado de OEP (backfill histórico + radar forward).
ALTER TABLE convocatoria_documentos DROP CONSTRAINT IF EXISTS convocatoria_documentos_fuente_check;
ALTER TABLE convocatoria_documentos ADD CONSTRAINT convocatoria_documentos_fuente_check
  CHECK (fuente = ANY (ARRAY['detect-notas','radar','seguimiento','manual','backfill-titulo','epigrafe-verify','oep-backfill','oep-radar']));

-- ── updated_at automático ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION tg_oep_touch() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS oep_touch ON oep;
CREATE TRIGGER oep_touch BEFORE UPDATE ON oep FOR EACH ROW EXECUTE FUNCTION tg_oep_touch();

COMMENT ON TABLE oep IS
  'OEP como entidad de primer nivel (F1 de T-108). Un decreto anual que aprueba plazas para una oposición; puede acumularse sin convocar (estado=aprobada = backlog) y una convocatoria agrupa varias vía convocatoria_oep. Sustituye al texto libre oposiciones/convocatorias.oep_decreto+oep_fecha (que sigue como legacy hasta F4). Documento del decreto clonado en el hub: source_documento_id (tipo oep_decreto).';
COMMENT ON TABLE convocatoria_oep IS
  'Puente N:M: qué OEP(s) agrupa una convocatoria. N OEP→1 conv (acumulación) · 1 OEP→N conv (turno libre + promoción interna).';
COMMENT ON COLUMN convocatoria_documentos.oep_id IS
  'Enlace inverso al decreto de OEP clonado (tipo=oep_decreto). NULL para documentos de convocatoria/bases/temario.';
