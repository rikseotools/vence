-- Migración: Rellenar description en 56 topics que tenían solo epigrafe
-- Detectado por test temarioDataQuality.test.ts (56 topics con description NULL)
-- Afecta: CyL (28), Andalucía (22), CARM (5), Aux Admin Estado (1)
-- Creado: 2026-04-05

-- Copiar epigrafe → description donde description IS NULL
-- (Estos 4 oposiciones tienen epigrafe oficial pero el importador no rellenó description)
UPDATE topics
SET description = epigrafe,
    updated_at = NOW()
WHERE is_active = true
  AND description IS NULL
  AND epigrafe IS NOT NULL;

-- Regenerar descripcion_corta desde description (primera 1-2 oraciones, máx 180 chars)
-- Para los 4 oposiciones afectados
UPDATE topics
SET descripcion_corta = (
  CASE
    WHEN length(description) <= 180 THEN description
    ELSE substring(description FROM 1 FOR 177) || '...'
  END
)
WHERE is_active = true
  AND position_type IN (
    'auxiliar_administrativo_cyl',
    'auxiliar_administrativo_andalucia',
    'auxiliar_administrativo_carm',
    'auxiliar_administrativo_estado'
  );
