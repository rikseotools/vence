-- 20260807_law_verification_effective_is_ok.sql
--
-- La vista `law_verification_effective` daba `verified` a una ley cuyo propio
-- `last_verification_summary` dice `is_ok: false`.
--
-- CAUSA: esos summaries no siempre son una COMPARACIÓN (con `missing_in_db` /
-- `content_mismatch` / `title_mismatch`) — algunos son NOTAS DE INCIDENCIA que
-- escribió el detector `audit_boe_url` cuando el `boe_url` apuntaba a otro
-- documento distinto (p.ej. "boe_url ERRÓNEO: apuntaba a BOE-A-1994-9268 =
-- 'Real Decreto ... por el que se nombra Decano'"). Esa nota trae `is_ok: false`
-- pero ningún contador de artículos, así que la vista caía al `ELSE 'verified'`
-- final — exactamente el `false_green` que esta vista existe para cazar, colado
-- por otra puerta.
--
-- Medido el 07/08/2026 (reproducido ejecutando el criterio real contra RDS, no
-- solo leído): 9 leyes con `is_ok:false` sin exención legítima quedaban en
-- `verified/actionable:false` — OPCAT (114 preguntas activas en temas vivos),
-- Convenio Schengen (25), Orden 22/07/1987 (20), Convención Apátridas (6),
-- RD 1087/2010 (3), Tratado Prüm (2), Convenio Prevención Tortura (1), Orden
-- HFP/147/2022 (1), Protocolo Sedes UE (0). Otras 3 con `is_ok:false`
-- (Ley 7/2014 Galicia, Decreto 326/2024, Reglamento Órganos Territoriales
-- Zaragoza) están correctamente exentas por `deliberate_subset` y NO cambian.
-- RGGIT también trae `is_ok:false` pero YA sale `incomplete` por
-- `missing_in_db` — tampoco cambia (esa rama tiene prioridad, como debe).
--
-- El módulo TS (`lib/laws/completeness.ts`, fuente única del criterio) y los
-- mirrors de `scripts/health-sweep.cjs` / `scripts/audit-law-completeness.cjs`
-- llevan el mismo arreglo. Esta migración alinea la vista con los tres.
--
-- NO cambia ningún otro tramo del criterio: las exenciones
-- (`no_consolidated_text` / `historical` / `deliberate_subset`), la resta
-- `missing_in_db` (arreglada en 20260731_..._db_count_desconocido.sql) y el
-- resto de estados quedan idénticos. La comprobación de `is_ok` va DESPUÉS de
-- `missing_in_db`/`content_mismatch`/`title_mismatch` a propósito: si el
-- summary SÍ trae una comparación real, esa manda (más específica que la nota).
--
-- Ver T-395.

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
    -- T-395: is_ok:false sin contadores es una nota de incidencia, no una comparación limpia.
    WHEN ((l.last_verification_summary ->> 'is_ok')::boolean) IS FALSE
      THEN 'never_verified'
    ELSE 'verified'
  END AS effective_state
FROM laws l;

COMMENT ON VIEW public.law_verification_effective IS
  'Estado de verificación de cada ley contra su fuente. ESPEJO de lib/laws/completeness.ts '
  '(fuente única del criterio): si se toca uno, se toca el otro — lo vigila '
  '__tests__/integration/lawCompletenessConsistency.integration.test.ts, ley a ley.';
