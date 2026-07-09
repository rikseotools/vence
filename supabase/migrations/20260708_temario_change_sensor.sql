-- Sensor `temario_change`: detección de modificaciones de temario/programa de oposiciones.
--
-- Cierra el gap del caso Cantabria (08/07/2026): la Orden PRE/12/2026 modificó el
-- programa de materias del Cuerpo General Auxiliar y NINGÚN sensor lo cazó, porque
-- toda la detección vigila convocatorias (plazas/fechas) y leyes, no el temario.
--
-- Roadmap: docs/roadmap/vigilancia-temario-frescura-contenido.md (Incremento 1).

BEGIN;

-- 1) Ampliar la taxonomía cerrada de sensor_type con 'temario_change'.
--    (misma mecánica que la migración radar-multicapa-fase0 que añadió 'competitor')
ALTER TABLE public.oep_detection_signals
  DROP CONSTRAINT IF EXISTS oep_detection_signals_sensor_type_check;
ALTER TABLE public.oep_detection_signals
  ADD CONSTRAINT oep_detection_signals_sensor_type_check
  CHECK (sensor_type = ANY (ARRAY[
    'llm_semantic','timeline_silence','hash_change','regional_scan','rss',
    'boe_api','google_cse','manual','generic_source','pag_empleo','competitor',
    'temario_change'
  ]));

-- 2) Registro de la NORMA-FUENTE del temario por oposición.
--    Es el ancla que permite detectar cuándo una Orden nueva MODIFICA el programa
--    que define nuestro temario. Se rellena a mano al construir/auditar cada
--    oposición (Claude); el sensor lo consulta para auto-vincular la señal.
CREATE TABLE IF NOT EXISTS public.oposicion_programa_normas (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oposicion_id                  uuid NOT NULL REFERENCES public.oposiciones(id) ON DELETE CASCADE,
  norma_ref                     text NOT NULL,   -- p.ej. 'Orden PRE/76/2024'
  cuerpo                        text,            -- cuerpo/escala tal como aparece en la norma
  ambito                        text,            -- 'estado' | 'cantabria' | ... (administración)
  boletin                       text,            -- 'BOE' | 'BOC' | 'BOCYL' | ...
  ultima_modificacion_conocida  text,            -- p.ej. 'Orden PRE/12/2026'
  notas                         text,
  is_active                     boolean NOT NULL DEFAULT true,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programa_normas_oposicion
  ON public.oposicion_programa_normas(oposicion_id);
-- Búsqueda por referencia normalizada (auto-vinculación del sensor).
CREATE INDEX IF NOT EXISTS idx_programa_normas_norma_ref
  ON public.oposicion_programa_normas(lower(norma_ref));

COMMIT;
