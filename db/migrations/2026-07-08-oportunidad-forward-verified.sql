-- Modelo OPORTUNIDAD — Paso 1: anclar el CONOCIMIENTO en la oposición (el cuerpo,
-- que siempre existe), no en la oportunidad (que puede no existir aún: OEP sin
-- convocar, o sin OEP nueva). Hace que un `null` de fechas deje de ser mudo.
--
-- `forward_verified_at`  = cuándo verificamos por última vez el estado de la
--    PRÓXIMA oportunidad de este cuerpo contra fuente oficial. **null = NUNCA
--    mirado** → es la cola de trabajo. Un "verificado: no hay OEP nueva" (legítimo,
--    no vendible) se distingue así de "no lo sé" AUNQUE no haya fila de oportunidad.
-- `forward_verified_source` = la fuente oficial consultada.
--
-- Additivo, nullable, sin default, sin lector todavía → no rompe nada (verificado:
-- vista oposiciones_ssot usa columnas explícitas, sin triggers, 2500/2500 intactas).
-- Modelo completo: memoria project_modelo_oportunidad_vendibilidad.
-- Aplicado a prod 2026-07-08.

ALTER TABLE oposiciones
  ADD COLUMN IF NOT EXISTS forward_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS forward_verified_source text;

COMMENT ON COLUMN oposiciones.forward_verified_at IS
  'Última verificación (fuente oficial) del estado de la próxima oportunidad del cuerpo. null = nunca verificado = cola.';
COMMENT ON COLUMN oposiciones.forward_verified_source IS
  'Fuente oficial de la última verificación de forward_verified_at.';
