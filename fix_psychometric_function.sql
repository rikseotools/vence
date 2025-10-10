-- Drop and recreate the function with correct column references
DROP FUNCTION IF EXISTS get_effective_psychometric_difficulty(uuid, uuid);

CREATE OR REPLACE FUNCTION get_effective_psychometric_difficulty(
    p_question_id uuid,
    p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
    base_difficulty text,
    global_difficulty numeric,
    personal_difficulty numeric,
    sample_size integer,
    effective_difficulty numeric,
    recommendation text
) 
LANGUAGE plpgsql
AS $$
DECLARE
    v_base_difficulty text;
    v_global_difficulty numeric;
    v_personal_difficulty numeric;
    v_sample_size integer := 0;
    v_effective_difficulty numeric;
    v_recommendation text;
    v_base_numeric numeric;
BEGIN
    -- Get base difficulty from psychometric_questions table
    SELECT pq.difficulty
    INTO v_base_difficulty
    FROM psychometric_questions pq
    WHERE pq.id = p_question_id;
    
    IF v_base_difficulty IS NULL THEN
        v_base_difficulty := 'medium';
    END IF;
    
    -- Convert base difficulty text to numeric
    CASE v_base_difficulty
        WHEN 'easy' THEN v_base_numeric := 25.0;
        WHEN 'medium' THEN v_base_numeric := 50.0;
        WHEN 'hard' THEN v_base_numeric := 75.0;
        ELSE v_base_numeric := 50.0;
    END CASE;
    
    -- Get global difficulty (from first attempts)
    SELECT 
        pq.global_difficulty,
        COALESCE(pq.difficulty_sample_size, 0)
    INTO v_global_difficulty, v_sample_size
    FROM psychometric_questions pq
    WHERE pq.id = p_question_id;
    
    -- Get personal difficulty if user provided
    IF p_user_id IS NOT NULL THEN
        -- Calculate personal difficulty based on user's history with this question
        SELECT 
            CASE 
                WHEN COUNT(*) >= 3 THEN
                    GREATEST(10.0, LEAST(90.0, 
                        v_base_numeric + 
                        (AVG(CASE WHEN is_correct THEN -10 ELSE 15 END))
                    ))
                ELSE NULL
            END
        INTO v_personal_difficulty
        FROM psychometric_test_answers pta
        WHERE pta.question_id = p_question_id 
        AND pta.user_id = p_user_id;
    END IF;
    
    -- Determine effective difficulty (priority: personal > global > base)
    IF v_personal_difficulty IS NOT NULL THEN
        v_effective_difficulty := v_personal_difficulty;
        v_recommendation := 
            CASE 
                WHEN v_personal_difficulty < v_base_numeric - 15 THEN 'decrease_difficulty'
                WHEN v_personal_difficulty > v_base_numeric + 15 THEN 'increase_difficulty'
                ELSE 'optimal'
            END;
    ELSIF v_global_difficulty IS NOT NULL AND v_sample_size >= 5 THEN
        v_effective_difficulty := v_global_difficulty;
        v_recommendation := 
            CASE 
                WHEN v_global_difficulty < v_base_numeric - 15 THEN 'decrease_difficulty'
                WHEN v_global_difficulty > v_base_numeric + 15 THEN 'increase_difficulty'
                ELSE 'optimal'
            END;
    ELSE
        v_effective_difficulty := v_base_numeric;
        v_recommendation := 
            CASE 
                WHEN v_sample_size < 5 THEN 'need_more_data'
                ELSE 'fallback'
            END;
    END IF;
    
    -- Return results
    RETURN QUERY SELECT 
        v_base_difficulty,
        v_global_difficulty,
        v_personal_difficulty,
        v_sample_size,
        v_effective_difficulty,
        v_recommendation;
END;
$$;
