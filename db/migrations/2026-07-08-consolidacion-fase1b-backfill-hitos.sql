-- Consolidación SSOT — Fase 1b: backfill `convocatoria_hitos.convocatoria_id`.
-- Desbloqueado por Fase 1 (20260708_..._backfill_convocatorias_ssot): ahora cada
-- oposición tiene una convocatoria is_current, así que TODO hito se puede enlazar
-- a la convocatoria vigente de su oposición. Antes 17% (156/943); tras esto 100%.
-- Cierra el checklist §3.10 (prerrequisito de que algún reader filtre por
-- convocatoria_id y del drop de Fase 5).
--
-- UPDATE del FK (NUNCA DELETE+INSERT) → no re-spamea la campana de alertas (§3.9).
-- Ejecutado en prod 2026-07-08 (787 filas; 0 mal-enlazadas verificado).

UPDATE convocatoria_hitos h
SET convocatoria_id = c.id, updated_at = now()
FROM convocatorias c
WHERE c.oposicion_id = h.oposicion_id
  AND c.is_current = true
  AND h.convocatoria_id IS NULL;
