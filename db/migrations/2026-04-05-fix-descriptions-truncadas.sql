-- Migración: Rellenar description con epigrafe en 6 topics con descripción truncada
-- Detectado por test temarioDataQuality.test.ts: desc < title
-- Creado: 2026-04-05

-- Casos arreglados:
-- - Asturias T7: desc sobre "instituciones Título III" → epigrafe Ley 39/2015 completo
-- - Asturias T10: desc mencionaba Ley 2/1995 pero title era TREBEP → epigrafe TREBEP completo
-- - Canarias T19: desc solo "régimen disciplinario" → incluye "situaciones admin"
-- - Estado T12: desc con leyes RGPD/LOPD → epigrafe completo oficial
-- - Estado T105: desc "Conceptos básicos" → epigrafe Informática completo
-- - Estado T111: desc "Correo uso y gestión" → epigrafe Outlook completo
--
-- EXCLUIDOS a propósito:
-- - Estado T14: desc actual lista leyes fuente, info útil distinta de epigrafe
-- - CyL T1: epigrafe y desc ya son iguales (Constitución Española, texto corto)

UPDATE topics
SET description = epigrafe,
    descripcion_corta = CASE
      WHEN length(epigrafe) <= 180 THEN epigrafe
      ELSE substring(epigrafe FROM 1 FOR 177) || '...'
    END,
    updated_at = NOW()
WHERE (position_type, topic_number) IN (
  ('auxiliar_administrativo_asturias', 7),
  ('auxiliar_administrativo_asturias', 10),
  ('auxiliar_administrativo_canarias', 19),
  ('auxiliar_administrativo_estado', 12),
  ('auxiliar_administrativo_estado', 105),
  ('auxiliar_administrativo_estado', 111)
);
