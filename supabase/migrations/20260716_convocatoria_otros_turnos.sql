-- Turnos de reserva que el esquema no sabía representar + el total del proceso.
--
-- HALLAZGO (16/07/2026, triaje de señales OEP — administrativo-navarra): el BON 101/2025 reparte las
-- 585 plazas en CUATRO turnos:
--     «Las quinientas ochenta y cinco plazas vacantes se distribuirán en los siguientes turnos:
--      –264 plazas en el turno libre. –264 plazas en el turno de promoción. –51 plazas en el turno de
--      reserva para personas con discapacidad de grado igual o superior al 33 por 100.
--      –6 plazas en el turno de reserva para mujeres víctimas de violencia de género.»
--
-- `convocatorias` solo tenía columnas para los TRES primeros. El cuarto no cabía: nuestros números
-- eran correctos uno a uno, pero el TOTAL salía 579 donde el documento dice 585. No es un error de
-- dato: es un hueco del MODELO. Y una opositora que entra por ese cupo no veía sus 6 plazas.
--
-- POR QUÉ jsonb Y NO UNA COLUMNA POR TURNO: las tres columnas cubren el caso común de toda España y
-- no se tocan. La COLA es abierta y variable por administración (violencia de género, discapacidad
-- intelectual, militares de complemento, perfiles lingüísticos, estabilización…): una columna nueva
-- por cada cupo que se invente una comunidad es una migración por sorpresa cada trimestre. El jsonb
-- absorbe la cola sin tocar el núcleo.
--
-- Cada turno lleva su CITA: sin evidencia no se afirma (misma doctrina que convocatoria_hitos).

BEGIN;

ALTER TABLE public.convocatorias
  ADD COLUMN IF NOT EXISTS plazas_otros_turnos jsonb;

COMMENT ON COLUMN public.convocatorias.plazas_otros_turnos IS
  'Turnos de reserva fuera de los tres comunes (libre/promoción/discapacidad). Array: [{"turno":"violencia_genero","plazas":6,"cita":"<literal del boletín>"}]. Cola abierta a propósito: una columna por cupo sería una migración cada trimestre.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Total del proceso = los 3 comunes + la cola. Función y no columna: es DERIVADO, y duplicar un
-- hecho derivable es exactamente lo que hace driftar esta tabla (ver el diagnóstico del roadmap).
CREATE OR REPLACE FUNCTION public.convocatoria_plazas_total(p_convocatoria_id uuid)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT coalesce(c.plazas_libres, 0) + coalesce(c.plazas_promocion_interna, 0)
       + coalesce(c.plazas_discapacidad, 0)
       + coalesce((SELECT sum((t->>'plazas')::int)
                     FROM jsonb_array_elements(coalesce(c.plazas_otros_turnos, '[]'::jsonb)) t), 0)
    FROM public.convocatorias c
   WHERE c.id = p_convocatoria_id;
$$;

COMMENT ON FUNCTION public.convocatoria_plazas_total IS
  'Total de plazas del proceso: los 3 turnos comunes + plazas_otros_turnos. Derivado, NO almacenado: el total es función de sus partes y guardarlo sería una cuarta copia que drifta.';

COMMIT;
