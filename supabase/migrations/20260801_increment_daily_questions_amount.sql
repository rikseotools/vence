-- T-450 (01/08/2026): `increment_daily_questions` acepta un IMPORTE.
--
-- Por qué: el modo EXAMEN persiste sus respuestas EN BLOQUE (`/api/exam/validate`), así que
-- cobrarlas de una en una serían ~50 idas y vueltas a la base en un camino que el usuario está
-- esperando (le estamos dando su nota). Con `p_amount` se cobra el examen entero en UNA llamada.
--
-- `p_amount` va con DEFAULT 1, así que **todos los llamadores actuales siguen valiendo sin
-- tocarlos** (answer-and-save, psicotécnicos, ortografía). Hay que DROPear la versión de 2
-- argumentos antes: un CREATE OR REPLACE con un parámetro más crea una SOBRECARGA en vez de
-- reemplazar, y entonces las llamadas de 2 argumentos quedan ambiguas y fallan.
--
-- SE CONSERVA LA SATURACIÓN, que es la semántica de esta tabla: `questions_answered` es CUPO
-- CONSUMIDO, no cuenta bruta, y nunca pasa del tope. Por eso el importe entra por LEAST(...,
-- p_limit) y no como una suma libre. Y GREATEST(p_amount, 0) impide que un importe negativo
-- pueda DEVOLVER cupo: esta función solo cobra.
--
-- Escritor ÚNICO a propósito: `daily_question_usage` no puede tener una segunda puerta con
-- criterios distintos (ver CLAUDE.md, «impedir en el punto de escritura»).

DROP FUNCTION IF EXISTS public.increment_daily_questions(uuid, integer);

CREATE OR REPLACE FUNCTION public.increment_daily_questions(p_user_id uuid, p_limit integer DEFAULT 25, p_amount integer DEFAULT 1)
 RETURNS TABLE(can_answer boolean, questions_today integer, questions_remaining integer, is_limit_reached boolean, is_premium boolean, reset_time timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  DECLARE
    v_plan_type TEXT;
    v_today DATE;
    v_current_count INTEGER;
    v_is_premium BOOLEAN;
    v_reset_time TIMESTAMP WITH TIME ZONE;
  BEGIN
    v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;
    v_reset_time := (v_today + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE 'Europe/Madrid';

    SELECT up.plan_type INTO v_plan_type
    FROM user_profiles up
    WHERE up.id = p_user_id;

    v_is_premium := COALESCE(v_plan_type, 'free') IN ('premium', 'trial', 'legacy_free', 'premium_semester', 'admin');

    IF v_is_premium THEN
      RETURN QUERY SELECT
        TRUE::BOOLEAN,
        0::INTEGER,
        999::INTEGER,
        FALSE::BOOLEAN,
        TRUE::BOOLEAN,
        v_reset_time;
      RETURN;
    END IF;

    INSERT INTO daily_question_usage (user_id, usage_date, questions_answered, last_question_at, updated_at)
    VALUES (p_user_id, v_today, LEAST(GREATEST(p_amount, 0), p_limit), NOW(), NOW())
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET
      questions_answered = CASE
        WHEN daily_question_usage.questions_answered < p_limit
        THEN LEAST(daily_question_usage.questions_answered + GREATEST(p_amount, 0), p_limit)
        ELSE daily_question_usage.questions_answered
      END,
      last_question_at = NOW(),
      updated_at = NOW();

    SELECT dqu.questions_answered INTO v_current_count
    FROM daily_question_usage dqu
    WHERE dqu.user_id = p_user_id AND dqu.usage_date = v_today;

    IF v_current_count IS NULL THEN
      v_current_count := LEAST(GREATEST(p_amount, 0), p_limit);
    END IF;

    RETURN QUERY SELECT
      v_current_count <= p_limit,
      v_current_count,
      GREATEST(0, p_limit - v_current_count),
      v_current_count >= p_limit,
      FALSE::BOOLEAN,
      v_reset_time;
  END;
  $function$
;
