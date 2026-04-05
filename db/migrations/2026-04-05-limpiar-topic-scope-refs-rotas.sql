-- Migración: Limpiar 302 refs rotas en topic_scope
-- Detectado por test temarioDataQuality.test.ts
-- Creado: 2026-04-05

-- Problema detectado:
-- 44 topic_scope con article_numbers apuntando a artículos que no existen o están desactivados.
-- Casos principales:
--   Madrid T15 → Ley 6/2023 CM Archivos: 116 refs a arts 116-231 (la ley solo tiene arts 1-99).
--     Esos arts desactivados son en realidad contenido de LOMLOE importado por error.
--   CyL T3 → Ley 1/1998 CyL: 40 refs desactivadas
--   Auxilio Judicial T6 → LO 6/1985: 27 arts inexistentes + 2 desactivados
--   LECrim: 15 arts inexistentes
--   Otras: Ley 29/1998, Ley 40/2015, RD 1708/2011, Ley 1/1983 CM, etc.

-- Fix: filtrar topic_scope.article_numbers dejando solo artículos que existen y están activos.
-- Safe: los arts no válidos no tenían preguntas de todas formas, removerlos no afecta tests.

UPDATE topic_scope ts
SET article_numbers = (
  SELECT array_agg(DISTINCT a.article_number ORDER BY a.article_number)
  FROM articles a
  WHERE a.law_id = ts.law_id
    AND a.article_number = ANY(ts.article_numbers)
    AND a.is_active = true
)
WHERE ts.article_numbers IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM unnest(ts.article_numbers) AS art_num
    LEFT JOIN articles a ON a.law_id = ts.law_id AND a.article_number = art_num AND a.is_active = true
    WHERE a.id IS NULL
  );

-- Verificación: tras esto, 0 refs rotas en topic_scope
-- SELECT COUNT(*) FROM (
--   SELECT ts.law_id, unnest(ts.article_numbers) as art_num
--   FROM topic_scope ts
--   WHERE ts.law_id IS NOT NULL AND ts.article_numbers IS NOT NULL
-- ) r
-- LEFT JOIN articles a ON a.law_id = r.law_id AND a.article_number = r.art_num AND a.is_active = true
-- WHERE a.id IS NULL;  -- Debe devolver 0
