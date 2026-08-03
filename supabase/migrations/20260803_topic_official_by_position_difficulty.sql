-- 20260803_topic_official_by_position_difficulty.sql
--
-- [T-507] El contador de un tema anuncia preguntas que su test NUNCA sirve.
--
-- El serve aplica SIEMPRE `buildOfficialExamFilter` (lib/api/oposicion-scope/queries.ts):
-- una pregunta de examen oficial solo se sirve si su `exam_position` pertenece a la
-- oposición del usuario (anti-contaminación, caso Laura 14/04/2026). Los contadores
-- NO lo aplicaban, así que anunciaban preguntas que el test descartaba.
--
-- Caso que lo destapa: subalterno_gva tema 3 anunciaba 39 y servía 22 — las 17 que
-- faltaban son oficiales de `auxiliar_administrativo_valencia` (feedback 8b788ee0).
--
-- Para descontarlas del total NO hace falta nada nuevo (`topic_official_by_position`
-- ya da las oficiales por exam_position). Pero la ficha del tema pinta el total como
-- SUMA DE LOS CUBOS DE DIFICULTAD (`TemaTestPage.tsx`), así que sin el desglose por
-- dificultad de esas oficiales el rótulo seguiría diciendo 39. De ahí esta migración:
-- añade a la MV los mismos cinco cubos que ya tiene `topic_law_question_summary`,
-- calculados con la MISMA función (`topic_question_difficulty_bucket`), para poder
-- restar cubo a cubo.
--
-- Additiva en lectura: `official_questions` y las claves no cambian de forma ni de
-- semántica; solo se añaden columnas. Cualquier lector viejo sigue funcionando.

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS public.topic_official_by_position;

CREATE MATERIALIZED VIEW public.topic_official_by_position AS
SELECT ts.topic_id,
       -- Las oficiales SIN exam_position (33 en el banco el 03/08) tampoco las
       -- sirve nadie: ninguna oposición las reclama. Antes quedaban FUERA de esta
       -- MV, así que no se podían descontar y se seguían anunciando en 141 temas.
       -- Se agrupan bajo '' — cadena que jamás está en EXAM_POSITION_MAP, así que
       -- cuentan como ajenas (se restan) y nunca como propias (no inflan el 🏛️).
       COALESCE(lower(q.exam_position), '') AS exam_position,
       (count(*))::integer AS official_questions,
       (count(*) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'easy'))::integer    AS count_easy,
       (count(*) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'medium'))::integer  AS count_medium,
       (count(*) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'hard'))::integer    AS count_hard,
       (count(*) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'extreme'))::integer AS count_extreme,
       (count(*) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'auto'))::integer    AS count_auto,
       now() AS computed_at
  FROM topic_scope ts
  JOIN articles a
    ON a.law_id = ts.law_id
   AND (ts.article_numbers IS NULL OR a.article_number = ANY (ts.article_numbers))
  JOIN questions q
    ON q.primary_article_id = a.id
 WHERE q.is_active = true
   AND q.exam_case_id IS NULL
   AND q.is_official_exam = true
 GROUP BY ts.topic_id, COALESCE(lower(q.exam_position), '');

-- UNIQUE es requisito de REFRESH MATERIALIZED VIEW CONCURRENTLY, que es como la
-- refresca `refresh_topic_question_summary()`. Sin él, el refresh nocturno falla.
CREATE UNIQUE INDEX topic_official_by_position_pk
  ON public.topic_official_by_position USING btree (topic_id, exam_position);
CREATE INDEX topic_official_by_position_topic_idx
  ON public.topic_official_by_position USING btree (topic_id);

COMMENT ON MATERIALIZED VIEW public.topic_official_by_position IS
  'Preguntas de examen oficial por (tema, exam_position), con desglose por cubo de dificultad. '
  'Doble uso: contar las oficiales PROPIAS de la oposición (rótulo "🏛️ N de exámenes oficiales") y '
  'DESCONTAR las AJENAS del total anunciado, porque buildOfficialExamFilter nunca las sirve [T-507].';

COMMIT;
