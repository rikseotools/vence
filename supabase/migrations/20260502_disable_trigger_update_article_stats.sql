-- Migration: disable_trigger_update_article_stats (Fase 1 escalabilidad)
-- 2026-05-02
--
-- Convierte trigger_update_article_stats() a NO-OP para eliminar el peor
-- cuello de botella de INSERT en test_questions.
--
-- Por qué (investigación exhaustiva 2026-05-02 confirmada por 7 vías):
--
-- El trigger original hacía 2 subqueries con JOIN a `tests` por cada INSERT,
-- escaneando todas las respuestas históricas del usuario en el artículo.
-- Caso peor real: usuario 64bfbb46 tiene 2027 respuestas en artículo
-- 514fe942 → cada nueva respuesta escaneaba 2027+2027 = 4054 filas.
--
-- Actualizaba `previous_attempts_this_article` y `historical_accuracy_this_article`
-- en cada fila de test_questions. Verificación exhaustiva confirmó que NINGÚN
-- código del repo lee esos campos:
--   1. grep en TS/JS/SQL/CJS/MJS/JSX/TSX/MD: 0 readers
--   2. vistas SQL que tocan test_questions: 0 vistas existen
--   3. funciones SQL que referencian los campos: solo el propio trigger
--   4. select * o selects amplios: ninguno (todos especifican columnas)
--   5. /api/stats (perfil de artículos del usuario): calcula en vivo con
--      GROUP BY article_id desde is_correct, sin leer estos campos
--   6. /api/v2/topic-progress/weak-articles: usa user_question_history
--      (otra tabla, mantenida por trigger #5), no estos campos
--   7. páginas /teoria/[law]/[articleNumber] y /temarios: solo lectura del
--      contenido legal, no muestran stats personales
--
-- El trigger es un fósil de la migración inicial cuya lógica nunca se conectó
-- a ninguna feature visible. Cuando se diseñaron getArticleStats() y
-- weak-articles, optaron por queries en vivo (correcto), no por leer estos
-- campos pre-calculados.
--
-- Por qué NO-OP en vez de DROP:
-- - Reversibilidad inmediata si algún sistema externo (BI, Metabase, ETL
--   fuera del repo) lee los campos. Si en 2-4 semanas nadie se queja, se
--   hará DROP del trigger en migración aparte.
-- - Las columnas previous_attempts_this_article y historical_accuracy_this_article
--   se mantienen (siguen rellenándose con DEFAULT 0 en el INSERT desde cliente).
--   Drizzle schema y código existente siguen funcionando sin cambios.
--
-- Si necesitas reactivar el trigger original, el cuerpo está commiteado en
-- el repo en alguna migración previa o se puede recuperar con git blame
-- a este commit y revertir el body.

CREATE OR REPLACE FUNCTION public.trigger_update_article_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN NEW;
END;
$$;
