-- Registro documental del proceso + hitos TIPADOS con provenance.
-- Diseño: docs/roadmap/verificacion-convocatorias-documentos-proceso.md
--
-- DIAGNÓSTICO (medido en prod 16/07/2026): el mismo hecho vive en varios sitios, en texto libre y sin
-- fuente → drifta POR CONSTRUCCIÓN. exam_date vs el hito "Primer ejercicio" ya discrepan en 3 de 10
-- (administrativo-extremadura: 14-nov-2026 en la columna, 30-jun-2026 en su hito). "Cierre del plazo"
-- se escribe de 7 formas (~136 filas del mismo concepto). 735 de 983 hitos no tienen ni URL.
--
-- PRINCIPIO: un hecho, un sitio, una fuente. El hito TIPADO es el hecho; lo demás se deriva.
-- Y no se RESTRINGE, se ETIQUETA: hay convocatorias cerradas donde todo es citable y oposiciones que
-- hay que vender sin apenas datos. Ambas son legítimas — lo que no es legítimo es que una estimación
-- se presente como fecha oficial (ESE fue el bug de Marta).
--
-- PRERREQUISITO ya hecho: 20260716_convocatoria_ciclo_inmutable.sql (la provenance sobre una fila
-- mutable muere en el rollover).

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. convocatoria_documentos — el corpus del proceso.
--    "Documentos enteros scrapeados O sus partes esenciales": LOS DOS.
--      · extracted_text  = el documento ENTERO (evidencia durable, sobrevive al link-rot)
--      · llm_extraction  = las partes esenciales, estructuradas (citas, fechas, plazas, confianza)
--    Generaliza `convocatoria_notas` (que ya guarda url + content_hash + llm_extraction por PDF);
--    no se crea un sistema paralelo: detect-notas-convocatoria sembrará esta tabla.
CREATE TABLE IF NOT EXISTS public.convocatoria_documentos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convocatoria_id  uuid NOT NULL REFERENCES public.convocatorias(id) ON DELETE RESTRICT,
  tipo             text NOT NULL CHECK (tipo IN (
                     'oep_decreto','bases','convocatoria','temario','correccion_errores',
                     'lista_admitidos','resolucion_tribunal','anuncio_fecha','nota','otro')),
  url              text NOT NULL,
  titulo           text,
  boletin          text,                    -- BOE/BOCM/DOGV/DOGC/BOP… (identidad de la fuente)
  referencia       text,                    -- 'BOE-A-2025-24633', 'Orden 1634/2026', 'BOP Cádiz nº 28'
  fecha_publicacion date,
  content_hash     text,                    -- sha256 del texto extraído → detecta enmiendas
  extracted_text   text,                    -- el documento ENTERO (snapshot durable)
  llm_extraction   jsonb,                   -- { fecha_examen, plazas_*, citas:[{campo,cita_literal,base}], confianza }
  confianza        int CHECK (confianza IS NULL OR (confianza BETWEEN 0 AND 100)),
  fuente           text NOT NULL DEFAULT 'manual'
                     CHECK (fuente IN ('detect-notas','radar','seguimiento','manual','backfill-titulo')),
  fetched_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
-- una corrección de errores = documento NUEVO (hash distinto) → fila nueva, no UPDATE
CREATE UNIQUE INDEX IF NOT EXISTS uq_conv_doc_url_hash
  ON public.convocatoria_documentos(convocatoria_id, url, coalesce(content_hash,''));
CREATE INDEX IF NOT EXISTS idx_conv_doc_conv ON public.convocatoria_documentos(convocatoria_id);
CREATE INDEX IF NOT EXISTS idx_conv_doc_tipo ON public.convocatoria_documentos(tipo);

COMMENT ON TABLE public.convocatoria_documentos IS
  'Corpus del proceso: 1 fila por documento oficial. extracted_text = entero (evidencia); llm_extraction = partes esenciales. ON DELETE RESTRICT: la evidencia no se borra en cascada.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. convocatoria_hitos: TIPO + ORIGEN + PROVENANCE (se extiende la tabla viva, sin tabla nueva)

-- 2a. `tipo` — vocabulario CERRADO de 17, derivado del barrido de los 558 títulos reales (no de un
--     vistazo al top-14: ese error dejaba fuera tribunal_constituido, plantilla_respuestas,
--     reconocimiento_medico y modificacion_plazas, que el dato SÍ tiene).
--     `nombramientos` (12 filas) se cayó de la lista al transcribirla → el CHECK abortó el backfill.
--     Se deja constancia: la constraint hizo su trabajo. Ese es el punto de tener el vocabulario
--     CERRADO en la BD y no solo en el script — un enum en prosa no habría cazado nada.
ALTER TABLE public.convocatoria_hitos ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.convocatoria_hitos DROP CONSTRAINT IF EXISTS convocatoria_hitos_tipo_chk;
ALTER TABLE public.convocatoria_hitos ADD CONSTRAINT convocatoria_hitos_tipo_chk CHECK (
  tipo IS NULL OR tipo IN (
    'oep_aprobada','convocatoria_publicada','bases_publicadas','programa_publicado',
    'plazo_inicio','plazo_fin','lista_provisional','lista_definitiva','tribunal_constituido',
    'ejercicio_1','ejercicio_2','plantilla_respuestas','resultados','reconocimiento_medico',
    'modificacion_plazas','nombramientos','otro'
  )
);

-- 2b. `origen` — EL EJE QUE FALTABA. Ortogonal a `tipo`, a la precisión y a la verificación:
--       registro    → el documento dice la fecha, literal        → se VERIFICA contra el documento
--       inferencia  → el documento da una REGLA; derivamos ventana → se RECALCULA si cambia su input
--       estimacion  → sin documento; criterio propio (ciclo, histórico) → CADUCA
--     Las 3 son legítimas. Lo ilegítimo es que una `estimacion` se pinte como fecha oficial.
ALTER TABLE public.convocatoria_hitos ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'registro';
ALTER TABLE public.convocatoria_hitos DROP CONSTRAINT IF EXISTS convocatoria_hitos_origen_chk;
ALTER TABLE public.convocatoria_hitos ADD CONSTRAINT convocatoria_hitos_origen_chk
  CHECK (origen IN ('registro','inferencia','estimacion'));

-- 2c. provenance
ALTER TABLE public.convocatoria_hitos ADD COLUMN IF NOT EXISTS source_documento_id uuid
  REFERENCES public.convocatoria_documentos(id) ON DELETE SET NULL;
ALTER TABLE public.convocatoria_hitos ADD COLUMN IF NOT EXISTS cita_literal text;
ALTER TABLE public.convocatoria_hitos ADD COLUMN IF NOT EXISTS confianza int
  CHECK (confianza IS NULL OR (confianza BETWEEN 0 AND 100));
ALTER TABLE public.convocatoria_hitos ADD COLUMN IF NOT EXISTS fecha_aproximada boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.convocatoria_hitos.origen IS
  'registro=el documento lo dice literal | inferencia=derivado de una REGLA del documento | estimacion=criterio propio sin documento. Ortogonal a fecha_aproximada (precisión) y a la verificación.';
COMMENT ON COLUMN public.convocatoria_hitos.fecha_aproximada IS
  'Precisión de la fecha ("mayo de 2027" sin día). NO confundir con origen: una fecha puede ser aproximada Y oficial (caso Marta: la base 9 dice literalmente "mayo de 2027").';

CREATE INDEX IF NOT EXISTS idx_hitos_tipo   ON public.convocatoria_hitos(convocatoria_id, tipo);
CREATE INDEX IF NOT EXISTS idx_hitos_origen ON public.convocatoria_hitos(origen);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. INVARIANTES DETERMINISTAS — "cazarlo al instante", sin documento y sin IA.
--    Solo pares UNIVERSALES y comparaciones DENTRO de un mismo ciclo. Nada de orden total: los procesos
--    son heterogéneos (concurso-oposición, 1-3 ejercicios, con o sin lista provisional) y un orden único
--    sería una máquina de falsos positivos. Nada de heurísticas sobre el TEXTO del título (ese error ya
--    se cometió y se retiró: el año citado en un título NO es pertenencia a un ciclo).
-- ⚠️ Pares y tipos ACOTADOS tras simular contra los 983 hitos reales (16/07). El primer borrador daba
--    12 I1 y 55 I2, y al verificarlos a mano la mayoría eran FALSOS POSITIVOS:
--     · `convocatoria_publicada ≤ plazo_inicio` → fuera: en administrativo-madrid conviven
--       "Convocatoria (Orden 1070/2025)" y "Publicación en BOCM" — la orden se FIRMA y LUEGO se publica:
--       son dos hitos legítimos, no un desorden.
--     · I2 sobre `convocatoria_publicada`/`oep_aprobada` → fuera: NO son únicos por ciclo (misma razón,
--       y una convocatoria puede acumular plazas de varias OEP).
--    Tras acotar: I1=3 e I2=14, TODOS verificados como bugs reales (p.ej. celador-sermas-madrid abre el
--    plazo el 7-ago y lo cerró el 6-ago). Un invariante que se apaga por ruidoso no protege de nada.
CREATE OR REPLACE VIEW public.convocatoria_hito_incidencias AS
-- I1 · pares universales, dentro del MISMO ciclo
SELECT h1.convocatoria_id, h1.id AS hito_id, 'I1_orden'::text AS invariante,
       format('%s (%s) es posterior a %s (%s)', h1.tipo, h1.fecha, h2.tipo, h2.fecha) AS detalle
  FROM public.convocatoria_hitos h1
  JOIN public.convocatoria_hitos h2
    ON h2.convocatoria_id = h1.convocatoria_id AND h1.fecha > h2.fecha
 WHERE (h1.tipo, h2.tipo) IN (
         ('plazo_inicio','plazo_fin'), ('plazo_fin','ejercicio_1'), ('ejercicio_1','resultados'))
UNION ALL
-- I2 · unicidad SOLO de los tipos que son únicos por ciclo (dos fechas de examen = una miente)
SELECT h.convocatoria_id, (array_agg(h.id ORDER BY h.fecha))[1], 'I2_duplicado',
       format('%s aparece %s veces con fechas distintas', h.tipo, count(*))
  FROM public.convocatoria_hitos h
 WHERE h.tipo IN ('ejercicio_1','plazo_inicio','plazo_fin')
 GROUP BY h.convocatoria_id, h.tipo
HAVING count(DISTINCT h.fecha) > 1
UNION ALL
-- I5 · cobertura: un hito que dice ser REGISTRO oficial pero no cita documento.
--      NO aplica a inferencia/estimacion — esas no necesitan cita de fecha, por definición.
SELECT h.convocatoria_id, h.id, 'I5_registro_sin_fuente',
       format('%s se presenta como oficial pero no cita documento', coalesce(h.tipo,'(sin tipo)'))
  FROM public.convocatoria_hitos h
 WHERE h.origen = 'registro' AND h.source_documento_id IS NULL
UNION ALL
-- I6 · vocabulario: título que no casó al migrar (50 filas → 'otro'; son one-offs reales:
--      "nota informativa", "adaptaciones para personas con discapacidad", "774 aspirantes admitidos"…)
SELECT h.convocatoria_id, h.id, 'I6_sin_tipo', format('título sin tipo: %s', h.titulo)
  FROM public.convocatoria_hitos h WHERE h.tipo IS NULL OR h.tipo = 'otro'
UNION ALL
-- I7 · una PREVISIÓN es una afirmación con fecha de caducidad, y nadie las vigila
SELECT h.convocatoria_id, h.id, 'I7_prevision_caducada',
       format('previsión de %s ya pasada y sigue en pie', h.fecha)
  FROM public.convocatoria_hitos h
 WHERE h.origen = 'estimacion' AND h.fecha < current_date
UNION ALL
-- I8 · `status` guardado que contradice a su propia fecha (por eso status no debe guardarse;
--      GENERATED no vale: exige IMMUTABLE y now() no lo es → vive aquí, en la vista)
SELECT h.convocatoria_id, h.id, 'I8_status_contradice_fecha',
       format('status=%s con fecha %s', h.status, h.fecha)
  FROM public.convocatoria_hitos h
 WHERE (h.status = 'completed' AND h.fecha > current_date)
    OR (h.status = 'upcoming'  AND h.fecha < current_date);
-- (status='current' NO se toca: es editorial, no derivable de la fecha. 40 filas en prod lo usan.)

COMMENT ON VIEW public.convocatoria_hito_incidencias IS
  'Invariantes deterministas del timeline (sin IA, sin documento). Solo pares universales y dentro del mismo ciclo.';

COMMIT;
