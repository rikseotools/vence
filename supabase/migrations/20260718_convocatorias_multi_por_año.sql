-- 20260718_convocatorias_multi_por_año.sql
--
-- PROBLEMA: convocatorias tenía UNIQUE(oposicion_id, año), que codifica la
-- suposición FALSA de "una convocatoria por oposición y año". Es un caso real y
-- recurrente que una oposición tenga VARIAS convocatorias el mismo año:
--   - 2ª convocatoria / re-convocatoria del mismo cuerpo (caso disparador:
--     Auxiliar Admin. Comunidad de Madrid 2026 = Orden 264/2026 [feb] + Orden
--     1628/2026 [jul], ambas 2026, coexistiendo).
--   - Turno libre y promoción interna publicados en Ordenes distintas.
-- La constraint bloqueaba clonar la 2ª convocatoria como fila propia (SSOT).
--
-- SOLUCIÓN: sustituir la regla rígida por las DOS invariantes reales del dominio.
-- Escalable (N convocatorias por oposición, cualquier año) y sin chapuzas.
--
-- Pre-verificado sobre prod (18/07/2026): 0 oposiciones con >1 vigente activa,
-- 0 referencias oficiales duplicadas → los índices se crean sin conflicto.

BEGIN;

-- 1) Quitar la regla que impedía dos convocatorias el mismo año.
ALTER TABLE public.convocatorias
  DROP CONSTRAINT IF EXISTS "convocatorias_oposicion_id_año_key";

-- 2) Invariante que SÍ importa: como MUCHO una convocatoria vigente por oposición.
--    De ella depende la vista oposiciones_ssot (LATERAL ... WHERE is_current LIMIT 1):
--    sin este índice, dos filas is_current harían que la landing eligiera una al azar.
CREATE UNIQUE INDEX IF NOT EXISTS convocatorias_una_vigente_por_oposicion
  ON public.convocatorias (oposicion_id)
  WHERE is_current AND archived_at IS NULL;

-- 3) Identidad natural de una convocatoria = su referencia oficial (Orden/BOE).
--    Evita importar dos veces la MISMA convocatoria. Parcial: las filas legacy sin
--    referencia (convocatoria_numero IS NULL) no bloquean.
CREATE UNIQUE INDEX IF NOT EXISTS convocatorias_ref_oficial_unica
  ON public.convocatorias (oposicion_id, convocatoria_numero)
  WHERE convocatoria_numero IS NOT NULL;

COMMIT;
