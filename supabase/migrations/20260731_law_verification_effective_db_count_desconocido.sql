-- 20260731_law_verification_effective_db_count_desconocido.sql
--
-- La vista `law_verification_effective` daba `incomplete` a una ley que está bien.
--
-- CAUSA: calculaba los artículos que faltan como
--     COALESCE(missing_in_db, GREATEST(0, COALESCE(boe_count,0) - COALESCE(db_count,0)))
-- y ese `COALESCE(db_count, 0)` convierte «no sé cuántos artículos tenemos» en
-- «tenemos CERO». Para un summary con `boe_count: 182` y sin `db_count`, la vista
-- concluía 182 artículos faltantes — o sea, la ley entera — cuando la verificación
-- del 24/07 dice `is_ok: true` y 155/182 artículos coinciden exactos.
--
-- El módulo TS (`lib/laws/completeness.ts`, fuente única del criterio) ya lo hacía
-- bien: solo resta cuando conoce AMBOS lados, y si no, deja el dato como desconocido
-- y no concluye nada. Esta migración alinea la vista con él.
--
-- Detectado por `__tests__/integration/lawCompletenessConsistency.integration.test.ts`,
-- que compara vista ↔ módulo ley a ley. Afecta a 1 ley hoy (Ley 1/2015 Hacienda GVA,
-- 166 preguntas activas), pero el defecto es latente para cualquier verificación
-- futura que no anote `db_count`.
--
-- NO cambia ningún otro tramo del criterio: las exenciones
-- (`no_consolidated_text` / `historical` / `deliberate_subset`) y el resto de estados
-- quedan idénticos. El hueco de `is_ok` (9 leyes con `is_ok:false` publicadas como
-- verificadas) es OTRO defecto y va aparte: ver T-395.

CREATE OR REPLACE VIEW public.law_verification_effective AS
SELECT
  l.id AS law_id,
  l.short_name,
  l.scope,
  l.is_virtual,
  (l.boe_url IS NOT NULL AND btrim(l.boe_url) <> '') AS has_source,
  EXISTS (
    SELECT 1
      FROM topic_scope ts
      JOIN topics t ON t.id = ts.topic_id
     WHERE ts.law_id = l.id AND t.disponible
  ) AS serving_live,
  CASE
    WHEN COALESCE(l.is_virtual, false) THEN 'verified'
    WHEN l.last_verification_summary IS NULL THEN
      CASE
        WHEN lower(COALESCE(l.verification_status, '')) = ANY (ARRAY['actualizada', 'verificada']) THEN 'false_green'
        WHEN l.boe_url IS NULL OR btrim(l.boe_url) = '' THEN 'no_source'
        ELSE 'never_verified'
      END
    WHEN ((l.last_verification_summary ->> 'no_consolidated_text')::boolean) IS TRUE
      OR ((l.last_verification_summary ->> 'historical')::boolean) IS TRUE
      OR ((l.last_verification_summary ->> 'deliberate_subset')::boolean) IS TRUE
      THEN 'verified'
    -- Aquí está el cambio: la resta solo se hace si se conocen los DOS lados.
    -- Si falta `db_count`, el número de faltantes es DESCONOCIDO (NULL), no cero.
    WHEN COALESCE(
           (l.last_verification_summary ->> 'missing_in_db')::integer,
           CASE
             WHEN (l.last_verification_summary ->> 'boe_count') IS NOT NULL
              AND (l.last_verification_summary ->> 'db_count')  IS NOT NULL
             THEN GREATEST(0, (l.last_verification_summary ->> 'boe_count')::integer
                             - (l.last_verification_summary ->> 'db_count')::integer)
             ELSE NULL
           END
         ) > 0
      THEN 'incomplete'
    WHEN COALESCE((l.last_verification_summary ->> 'content_mismatch')::integer, 0) > 0
      OR COALESCE((l.last_verification_summary ->> 'title_mismatch')::integer, 0) > 0
      THEN 'issues'
    ELSE 'verified'
  END AS effective_state
FROM laws l;

COMMENT ON VIEW public.law_verification_effective IS
  'Estado de verificación de cada ley contra su fuente. ESPEJO de lib/laws/completeness.ts '
  '(fuente única del criterio): si se toca uno, se toca el otro — lo vigila '
  '__tests__/integration/lawCompletenessConsistency.integration.test.ts, ley a ley.';
