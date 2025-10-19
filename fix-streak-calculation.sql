-- Fix para añadir cálculo de rachas a update_user_learning_analytics()
-- Este script añade la lógica de rachas que faltaba en la función

CREATE OR REPLACE FUNCTION update_user_learning_analytics(
  user_uuid uuid, 
  article_uuid uuid, 
  tema_num integer, 
  opos_type text
)
RETURNS void AS $$
DECLARE
  total_attempts integer;
  correct_attempts integer;
  accuracy numeric;
  avg_time numeric;
  learning_style_detected text;
  mastery_level_calculated text;
  exam_readiness numeric;
  current_streak integer := 0;
  longest_streak integer := 0;
  check_date date;
  days_back integer;
  has_activity boolean;
  consecutive_misses integer := 0;
  streak_days integer := 0;
BEGIN
  -- Calcular métricas actuales (código original)
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_correct = true) as correct,
    AVG(time_spent_seconds)
  INTO total_attempts, correct_attempts, avg_time
  FROM test_questions tq
  JOIN tests t ON tq.test_id = t.id
  WHERE t.user_id = user_uuid 
    AND (article_uuid IS NULL OR tq.article_id = article_uuid);
  
  -- Calcular accuracy (código original)
  IF total_attempts > 0 THEN
    accuracy := (correct_attempts * 100.0 / total_attempts);
  ELSE
    accuracy := 0;
  END IF;
  
  -- 🆕 CÁLCULO DE RACHAS - Solo cuando es análisis general (article_uuid IS NULL)
  IF article_uuid IS NULL THEN
    -- Calcular racha actual (últimos 60 días, mismo límite que calculateUserStreak.js)
    FOR days_back IN 0..59 LOOP
      check_date := CURRENT_DATE - days_back;
      
      -- Verificar si hay actividad en este día (tests completados)
      SELECT EXISTS(
        SELECT 1 FROM tests t
        WHERE t.user_id = user_uuid 
          AND t.is_completed = true
          AND DATE(t.completed_at) = check_date
      ) INTO has_activity;
      
      IF has_activity THEN
        streak_days := streak_days + 1;
        consecutive_misses := 0;
        -- Actualizar longest_streak si es necesario
        IF streak_days > longest_streak THEN
          longest_streak := streak_days;
        END IF;
      ELSE
        consecutive_misses := consecutive_misses + 1;
        streak_days := streak_days + 1; -- Contar día de gracia
        
        -- Si faltas 2+ días seguidos, romper racha
        IF consecutive_misses >= 2 THEN
          streak_days := streak_days - 1; -- Restar último día sin actividad
          EXIT;
        END IF;
      END IF;
    END LOOP;
    
    current_streak := streak_days;
    
    -- También buscar la racha más larga histórica
    -- (Este es un cálculo simplificado, podría mejorarse)
    IF longest_streak < current_streak THEN
      longest_streak := current_streak;
    END IF;
  END IF;
  
  -- Detectar estilo de aprendizaje (código original)
  learning_style_detected := detect_learning_style(user_uuid);
  
  -- Calcular nivel de maestría (código original)
  CASE
    WHEN accuracy >= 85 AND total_attempts >= 20 THEN mastery_level_calculated := 'expert';
    WHEN accuracy >= 75 AND total_attempts >= 15 THEN mastery_level_calculated := 'advanced';
    WHEN accuracy >= 60 AND total_attempts >= 10 THEN mastery_level_calculated := 'intermediate';
    ELSE mastery_level_calculated := 'beginner';
  END CASE;
  
  -- Calcular preparación para examen (código original)
  exam_readiness := LEAST(100, (accuracy * 0.7) + (LEAST(total_attempts, 50) * 0.6));
  
  -- 🆕 UPSERT con campos de rachas añadidos
  INSERT INTO user_learning_analytics (
    user_id, article_id, tema_number, oposicion_type,
    total_questions_answered, overall_accuracy,
    learning_style, mastery_level, predicted_exam_readiness,
    current_streak_days, longest_streak_days,
    last_analysis_date, data_points_count
  ) VALUES (
    user_uuid, article_uuid, tema_num, opos_type,
    total_attempts, accuracy,
    learning_style_detected, mastery_level_calculated, exam_readiness,
    current_streak, longest_streak,
    now(), total_attempts
  )
  ON CONFLICT (user_id, article_id, oposicion_type) DO UPDATE SET
    total_questions_answered = EXCLUDED.total_questions_answered,
    overall_accuracy = EXCLUDED.overall_accuracy,
    learning_style = EXCLUDED.learning_style,
    mastery_level = EXCLUDED.mastery_level,
    predicted_exam_readiness = EXCLUDED.predicted_exam_readiness,
    current_streak_days = EXCLUDED.current_streak_days,
    longest_streak_days = EXCLUDED.longest_streak_days,
    last_analysis_date = EXCLUDED.last_analysis_date,
    data_points_count = EXCLUDED.data_points_count;
    
END;
$$ LANGUAGE plpgsql;

-- Verificar que la función se creó correctamente
SELECT proname FROM pg_proc WHERE proname = 'update_user_learning_analytics';