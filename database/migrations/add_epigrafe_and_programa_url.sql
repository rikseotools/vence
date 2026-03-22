-- Añadir epígrafe oficial a topics y URL del programa a oposiciones
-- Para que cada tema tenga el texto exacto del programa oficial
-- y cada oposición tenga el link a la convocatoria con el programa

-- 1. Epígrafe oficial en topics
ALTER TABLE topics ADD COLUMN IF NOT EXISTS epigrafe TEXT NULL;
COMMENT ON COLUMN topics.epigrafe IS 'Texto exacto del epígrafe del programa oficial (BOE/diario autonómico)';

-- 2. URL del programa oficial en oposiciones
ALTER TABLE oposiciones ADD COLUMN IF NOT EXISTS programa_url TEXT NULL;
COMMENT ON COLUMN oposiciones.programa_url IS 'URL al BOE o diario autonómico donde se publica el programa oficial';

-- 3. Referencia al diario autonómico (no siempre es BOE)
ALTER TABLE oposiciones ADD COLUMN IF NOT EXISTS diario_oficial TEXT NULL;
COMMENT ON COLUMN oposiciones.diario_oficial IS 'Nombre del diario oficial: BOE, DOCM, DOE, DOGV, BOJA, BOC, BOPA, etc.';

ALTER TABLE oposiciones ADD COLUMN IF NOT EXISTS diario_referencia TEXT NULL;
COMMENT ON COLUMN oposiciones.diario_referencia IS 'Referencia en el diario autonómico (ej: DOCM-2024-12345)';
