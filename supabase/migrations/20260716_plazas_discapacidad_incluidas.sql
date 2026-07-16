-- El cupo de discapacidad unas veces SUMA y otras va DENTRO. Sin saber cuál, el total es un invento.
--
-- HALLAZGO (16/07/2026, arreglando la tarjeta de administrativo-madrid): la Orden 1634/2026 (BOCM nº
-- 166 de 14/07/2026, corpus BOCM-20260714-6) dice literalmente:
--     «…uno para la cobertura de ciento siete (107) plazas para su provisión por el sistema general
--      de acceso libre, y otro para cubrir ciento cinco (105) plazas de promoción interna.»
--     «…se reservan siete (7) plaza DEL TOTAL DE LAS CONVOCADAS POR EL TURNO LIBRE y once (11) DEL
--      TOTAL DE LAS CONVOCADAS POR PROMOCIÓN INTERNA.»
-- → las 7 de discapacidad están DENTRO de las 107. El total convocado es 107+105 = 212. La función
-- `convocatoria_plazas_total()` y la vista sumaban L+P+D = 219: contaban 7 plazas DOS VECES.
--
-- Y no se puede arreglar sumando siempre o no sumando nunca, porque LAS DOS FORMAS SON REALES:
--   · DENTRO (Madrid): «se reservan 7 del total de las convocadas por el turno libre».
--   · APARTE (Navarra, BON 101/2025): «Las quinientas ochenta y cinco plazas se distribuirán en los
--     siguientes turnos: –264 libre. –264 promoción. –51 reserva discapacidad. –6 violencia de
--     género.» Aquí el cupo ES un turno más: si no se suma, el total baja a 579 y falta gente.
--   · APARTE (CLM, DOCM 240/2025): la tabla trae columnas «Cupo general» y «Reserva personas con
--     discapacidad» separadas, y totaliza cada una por su lado (1.346 / 62 / 21).
-- Una sola columna `plazas_discapacidad` no distingue un caso del otro. Faltaba el dato, no la
-- aritmética.
--
-- NULL = no consta. Se trata como APARTE (suma) porque es lo que dicen los dos documentos que hemos
-- leído enteros y verificado, y era el comportamiento hasta hoy: esta migración NO cambia ningún
-- total salvo donde haya evidencia literal de lo contrario. Cuando un documento diga «del total de
-- las convocadas», se marca `true` CON su cita, como todo lo demás en este sistema.

BEGIN;

ALTER TABLE public.convocatorias
  ADD COLUMN IF NOT EXISTS plazas_discapacidad_incluidas boolean;

COMMENT ON COLUMN public.convocatorias.plazas_discapacidad_incluidas IS
  'true = el cupo de discapacidad se reserva DENTRO de plazas_libres/promoción (no suma al total: Orden 1634/2026 Madrid «se reservan 7 del total de las convocadas por el turno libre»). false/NULL = es un turno APARTE y suma (BON 101/2025 Navarra, DOCM 240/2025 CLM). NULL = no consta; se asume aparte, que es lo verificado en los documentos leídos. Marcar true SOLO con cita literal.';

-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.convocatoria_plazas_total(p_convocatoria_id uuid)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT coalesce(c.plazas_libres, 0) + coalesce(c.plazas_promocion_interna, 0)
       -- El cupo solo suma si es un turno aparte. Si está reservado DENTRO del libre/promoción,
       -- sumarlo cuenta las mismas plazas dos veces (Madrid: 219 en vez de 212).
       + CASE WHEN c.plazas_discapacidad_incluidas IS TRUE THEN 0
              ELSE coalesce(c.plazas_discapacidad, 0) END
       + coalesce((SELECT sum((t->>'plazas')::int)
                     FROM jsonb_array_elements(coalesce(c.plazas_otros_turnos, '[]'::jsonb)) t), 0)
    FROM public.convocatorias c
   WHERE c.id = p_convocatoria_id;
$$;

COMMENT ON FUNCTION public.convocatoria_plazas_total IS
  'Total de plazas del proceso: libre + promoción + (discapacidad SOLO si es turno aparte) + plazas_otros_turnos. Derivado, NO almacenado. Ver plazas_discapacidad_incluidas: el cupo unas veces suma (Navarra, CLM) y otras va dentro (Madrid).';

COMMIT;
