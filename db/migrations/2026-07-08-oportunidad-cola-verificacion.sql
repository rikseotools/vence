-- Modelo OPORTUNIDAD — vista de COLA de verificación.
-- La cola NO se infiere ni se siembra: es simplemente lo NUNCA verificado (o viejo).
-- forward_verified_at IS NULL = nunca mirado. Ordenada por valor (demanda, activas).
-- Los HECHOS van en columnas para que el candidato (deriveOportunidad, en código) se
-- muestre al humano; la vista no deriva nada (una sola fuente de la lógica = el código).
-- Additivo. Aplicado a prod 2026-07-08.

CREATE OR REPLACE VIEW oposiciones_verificacion_pendiente AS
  SELECT id, slug, nombre, is_active, demand_score,
         forward_verified_at, forward_verified_source,
         oep_fecha, oep_decreto, plazas_libres,
         convocatoria_fecha, convocatoria_numero, boe_reference,
         inscription_start, inscription_deadline, exam_date, exam_date_approximate,
         estado_proceso, seguimiento_url
  FROM oposiciones
  WHERE forward_verified_at IS NULL
     OR forward_verified_at < now() - interval '30 days'
  ORDER BY demand_score DESC NULLS LAST, is_active DESC;
