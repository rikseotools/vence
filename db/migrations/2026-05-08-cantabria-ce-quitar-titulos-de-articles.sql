-- 2026-05-08-cantabria-ce-quitar-titulos-de-articles.sql
--
-- Limpia el array `article_numbers` del topic_scope de
-- `auxiliar_administrativo_cantabria` T2 ("La Constitución Española de 1978").
--
-- Problema detectado por __tests__/integration/temarioDataQuality.test.ts:
-- el scope tenía 22 valores que NO son artículos sino slugs de Títulos
-- (T1, T2, ..., T10, TP) y Capítulos (T1C1, T1C2, ..., T8C3) mezclados en
-- la columna `article_numbers`. La tabla `topic_scope` ya tiene columnas
-- dedicadas para esto: `title_numbers`, `chapter_numbers` (ambas null en
-- este scope, por lo que los Tx fueron escritos en la columna equivocada).
--
-- Esto causaba 22 referencias rotas en topic_scope→articles (cada `T*` no
-- existe como `article_number` activo en `articles`), inflando de 43 a 65
-- el contador del test "refs de topic_scope apuntan a artículos activos".
--
-- Decisión: ELIMINAR los 22 valores Tx/TxCx del array, sin moverlos a
-- title_numbers/chapter_numbers. Razón: el scope ya enumera explícitamente
-- los 169 artículos de la CE (1..169) + DA1..DA4 + DT1..DT9 + DD + DF +
-- preámbulo + 0, así que los Tx son redundantes (cualquier artículo
-- contenido por esos Títulos/Capítulos ya está listado individualmente).
-- Mover los Tx a title_numbers introduciría una doble cobertura sin
-- aportar nada y podría confundir al cargador del temario.
--
-- Idempotente: si los Tx ya no están, el UPDATE no afecta filas.

UPDATE topic_scope
SET article_numbers = ARRAY(
  SELECT v FROM unnest(article_numbers) AS v
  WHERE v NOT IN (
    -- Títulos
    'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'TP',
    -- Capítulos
    'T1C1', 'T1C2', 'T1C3', 'T1C4', 'T1C5',
    'T3C1', 'T3C2', 'T3C3',
    'T8C1', 'T8C2', 'T8C3'
  )
)
WHERE id = '259c8ee1-70fe-4ac1-86b7-b35a6dd6c015';

-- Verificación: ningún Tx debe quedar en article_numbers de este scope
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM unnest(
    (SELECT article_numbers FROM topic_scope WHERE id = '259c8ee1-70fe-4ac1-86b7-b35a6dd6c015')
  ) AS v
  WHERE v ~ '^T[0-9]+(C[0-9]+)?$' OR v = 'TP';

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Aún quedan % valores Tx/TPC* en article_numbers', remaining;
  END IF;
  RAISE NOTICE 'OK: 0 valores Tx/TxCy en article_numbers del scope cantabria T2.';
END $$;
