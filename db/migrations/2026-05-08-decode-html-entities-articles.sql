-- 2026-05-08-decode-html-entities-articles.sql
--
-- Decodifica entidades HTML en `articles.content` (e.g. &aacute; → á).
-- Detectado por __tests__/integration/articleContentIntegrity.test.ts:
-- 1 artículo (Resolución DGP 20/01/2014 art 10) tenía &aacute;, &iacute;,
-- &uacute;, &oacute; sin decodificar tras un import probablemente roto.
--
-- Esta migración es idempotente: usa REPLACE encadenado, así que aplicar
-- dos veces no rompe nada (la segunda iteración no encuentra entidades).
-- Cubre las entidades comunes en español (acentos + ñ + ü + ¿ + ¡ + «»);
-- &amp; va al final para no romper otras entidades que empiezan por &.
--
-- Solo afecta filas que contienen al menos una entidad — el WHERE recorta
-- el escaneo a esas filas y deja el resto intacto.

UPDATE articles
SET content = (
  SELECT
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(
    replace(content,
      '&aacute;', 'á'),
      '&Aacute;', 'Á'),
      '&eacute;', 'é'),
      '&Eacute;', 'É'),
      '&iacute;', 'í'),
      '&Iacute;', 'Í'),
      '&oacute;', 'ó'),
      '&Oacute;', 'Ó'),
      '&uacute;', 'ú'),
      '&Uacute;', 'Ú'),
      '&ntilde;', 'ñ'),
      '&Ntilde;', 'Ñ'),
      '&uuml;',   'ü'),
      '&Uuml;',   'Ü'),
      '&iquest;', '¿'),
      '&iexcl;',  '¡'),
      '&laquo;',  '«'),
      '&raquo;',  '»'),
      '&aelig;',  'æ'),
      '&AElig;',  'Æ'),
      '&oelig;',  'œ'),
      '&OElig;',  'Œ'),
      '&nbsp;',   ' '),
      '&quot;',   '"'),
      '&amp;',    '&')
),
updated_at = NOW()
WHERE content ~ '&(aacute|Aacute|eacute|Eacute|iacute|Iacute|oacute|Oacute|uacute|Uacute|ntilde|Ntilde|uuml|Uuml|iquest|iexcl|laquo|raquo|aelig|AElig|oelig|OElig|nbsp|quot|amp);';

-- Verificación: ningún artículo activo debería tener las entidades comunes ya
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM articles
  WHERE is_active = true
    AND content ~ '&(aacute|Aacute|eacute|Eacute|iacute|Iacute|oacute|Oacute|uacute|Uacute|ntilde|Ntilde);';

  IF remaining > 0 THEN
    RAISE NOTICE 'AVISO: % artículos activos aún tienen entidades de acento. Revisar manualmente.', remaining;
  ELSE
    RAISE NOTICE 'OK: 0 artículos activos con entidades de acento.';
  END IF;
END $$;
