-- 2026-05-08-consolidate-duplicate-articles.sql
--
-- Consolida 6 pares de filas duplicadas en `articles` (misma ley, mismo
-- artículo, formatos divergentes que solo difieren en espacio o mayúscula).
-- Detectados por __tests__/integration/topicScopeIntegrity.test.ts (#4.4).
--
-- Formato canónico = output de boeNormalize() de lib/boe-extractor.ts:
--   - Artículos con bis/ter: "<num> <sufijo>" (CON espacio, lowercase)
--   - Preámbulos: "preámbulo" (lowercase)
--
-- Pares (canonical_id ← dup_id):
--   LPRL:        "32 bis"    ← "32bis"
--   LO 4/2000:   "2 bis"     ← "2bis"
--   LO 4/2000:   "31 bis"    ← "31bis"
--   LO 4/2000:   "59 bis"    ← "59bis"
--   Ley 4/2015:  "preámbulo" ← "Preámbulo"
--   LO 14/2007:  "preámbulo" ← "Preámbulo"
--
-- Tablas con FK a articles.id verificadas (14 totales):
--   Solo 2 tienen refs a los dup_ids: questions.primary_article_id (20 refs total)
--   y ai_verification_results.article_id (3 refs solo en LO 14/2007).
--
-- topic_scope.article_numbers es array de TEXT (no FK). Solo 1 scope tiene
-- formato dup en su array: LO 4/2000 scope b5775221-... contiene "2bis".
-- También limpiamos LO 6/1985 GC T9 (#4.2: bis/ter inconsistente) y
-- CE administrativo_navarra T6 (quita "TP" — no es un article_number, es Título).
--
-- Idempotente: no falla si se ejecuta dos veces (los DELETE no encuentran
-- nada y los UPDATE no afectan filas).

BEGIN;

-- ============================================================================
-- 1. Migrar FK questions.primary_article_id de dup_id → canonical_id
-- ============================================================================
UPDATE questions SET primary_article_id = '1232e012-7076-42b2-b979-235c2cf2bedb' WHERE primary_article_id = '6727eab8-4a5d-4d87-99bc-0a27e1a93016'; -- LPRL 32bis → 32 bis
UPDATE questions SET primary_article_id = '3d947131-e412-4c08-8464-d28ba7adeb3c' WHERE primary_article_id = '5561ff3c-bddc-4467-acde-797888bbb186'; -- LO 4/2000 2bis → 2 bis
UPDATE questions SET primary_article_id = '953ce9a3-4ace-4f53-bc4d-5aad12b22ae9' WHERE primary_article_id = 'a37ba4f2-4173-4c0d-9715-f3e043eea06f'; -- LO 4/2000 31bis → 31 bis
UPDATE questions SET primary_article_id = '5f6f9d57-59ec-4937-a680-bbf0b30c4b9f' WHERE primary_article_id = '7d37e87f-4e31-4c38-a478-17ab654c1e90'; -- LO 4/2000 59bis → 59 bis
UPDATE questions SET primary_article_id = 'a9f749ec-cdcb-4216-b9ec-8c4228c66e96' WHERE primary_article_id = '669f52ae-1747-4e4a-9994-4a2f62266c00'; -- Ley 4/2015 Preámbulo → preámbulo
UPDATE questions SET primary_article_id = '2ece513f-8dcb-43d0-a150-698d93872b95' WHERE primary_article_id = '4d121018-9352-426b-a30c-40d9c59d171d'; -- LO 14/2007 Preámbulo → preámbulo

-- ============================================================================
-- 2. Migrar FK ai_verification_results.article_id (solo LO 14/2007)
-- ============================================================================
UPDATE ai_verification_results SET article_id = '2ece513f-8dcb-43d0-a150-698d93872b95' WHERE article_id = '4d121018-9352-426b-a30c-40d9c59d171d';

-- ============================================================================
-- 3. Limpiar topic_scope.article_numbers para usar formatos canónicos
-- ============================================================================

-- 3a. Cualquier topic_scope de LO 4/2000 con "2bis" / "31bis" / "59bis" / "32bis"
--     en su array → reemplazar por la versión con espacio, deduplicando.
--     Genérico: vale para cualquier scope futuro con esos formatos.
--     (Detectados al menos 2 scopes inicialmente: tramitacion_procesal T7 y
--     policia_nacional T10. Esta cláusula los cubre todos sin nombrarlos.)
UPDATE topic_scope
SET article_numbers = ARRAY(
  SELECT DISTINCT v
  FROM unnest(
    array_replace(
      array_replace(
        array_replace(
          array_replace(article_numbers, '2bis', '2 bis'),
          '31bis', '31 bis'
        ),
        '59bis', '59 bis'
      ),
      '32bis', '32 bis'
    )
  ) AS v
)
WHERE law_id IN (
  '8b1ae300-4ed3-4019-876c-780ea40ebbfe',  -- LPRL
  'f66fbad6-463e-4fef-aa75-d3dec90b7181'   -- LO 4/2000
)
AND (
  '2bis' = ANY(article_numbers) OR
  '31bis' = ANY(article_numbers) OR
  '59bis' = ANY(article_numbers) OR
  '32bis' = ANY(article_numbers)
);

-- 3b. LO 6/1985 Guardia Civil T9 scope 5189eaba-... contiene tanto "61 bis" como "61bis"
--     (mismos para 64 y 89). Quitar las versiones sin espacio (no existen en `articles`).
UPDATE topic_scope
SET article_numbers = ARRAY(
  SELECT v
  FROM unnest(article_numbers) AS v
  WHERE v NOT IN ('61bis', '64bis', '89bis')
)
WHERE id = '5189eaba-27ac-47bd-8101-c28468d5bd66';

-- 3c. CE administrativo_navarra T6 contiene "TP" como article_number — pero "TP" es
--     el slug del Título Preliminar, no un artículo. Los artículos del Título
--     Preliminar (1 al 9) ya están listados en el scope. Quitar "TP".
UPDATE topic_scope
SET article_numbers = array_remove(article_numbers, 'TP')
WHERE law_id = (SELECT id FROM laws WHERE short_name = 'CE')
  AND topic_id IN (SELECT id FROM topics WHERE position_type = 'administrativo_navarra' AND topic_number = 6)
  AND 'TP' = ANY(article_numbers);

-- ============================================================================
-- 4. Eliminar las 6 filas duplicadas de articles
-- ============================================================================
DELETE FROM articles
WHERE id IN (
  '6727eab8-4a5d-4d87-99bc-0a27e1a93016', -- LPRL "32bis"
  '5561ff3c-bddc-4467-acde-797888bbb186', -- LO 4/2000 "2bis"
  'a37ba4f2-4173-4c0d-9715-f3e043eea06f', -- LO 4/2000 "31bis"
  '7d37e87f-4e31-4c38-a478-17ab654c1e90', -- LO 4/2000 "59bis"
  '669f52ae-1747-4e4a-9994-4a2f62266c00', -- Ley 4/2015 "Preámbulo"
  '4d121018-9352-426b-a30c-40d9c59d171d'  -- LO 14/2007 "Preámbulo"
);

-- ============================================================================
-- 5. Verificación post-migración
-- ============================================================================
DO $$
DECLARE
  remaining_dups INT;
BEGIN
  -- No debe quedar ningún par duplicado por formato (lower(replace(' ', '')))
  SELECT COUNT(*) INTO remaining_dups FROM (
    SELECT law_id, lower(replace(article_number, ' ', '')) AS norm, COUNT(*) AS n
    FROM articles
    WHERE is_active = true
    GROUP BY law_id, norm
    HAVING COUNT(DISTINCT article_number) > 1
  ) sub;

  IF remaining_dups > 0 THEN
    RAISE NOTICE 'AVISO: quedan % grupos con article_number duplicado por formato. Revisar manualmente.', remaining_dups;
  ELSE
    RAISE NOTICE 'OK: 0 duplicados de article_number por formato en articles.';
  END IF;
END $$;

COMMIT;
