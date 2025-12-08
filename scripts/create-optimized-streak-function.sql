-- SOLUCIÓN OPTIMIZADA PARA ACTUALIZACIÓN DE RACHAS
-- Este sistema no necesita revisar 60+ días de historial
-- Solo mira los últimos días necesarios para mantener la racha

-- Función optimizada para actualizar rachas
CREATE OR REPLACE FUNCTION update_user_streak_optimized()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_today DATE;
    v_yesterday DATE;
    v_current_streak INTEGER;
    v_last_activity DATE;
    v_has_activity_today BOOLEAN;
    v_has_activity_yesterday BOOLEAN;
BEGIN
    -- Obtener el user_id del test
    v_user_id := NEW.user_id;
    v_today := CURRENT_DATE;
    v_yesterday := v_today - INTERVAL '1 day';

    -- Obtener racha actual y última actividad
    SELECT current_streak, last_activity_date
    INTO v_current_streak, v_last_activity
    FROM user_streaks
    WHERE user_id = v_user_id;

    -- Si no existe registro, crear uno nuevo
    IF NOT FOUND THEN
        INSERT INTO user_streaks (
            user_id,
            current_streak,
            longest_streak,
            last_activity_date
        ) VALUES (
            v_user_id,
            1,
            1,
            v_today
        );
        RETURN NEW;
    END IF;

    -- Si ya hubo actividad hoy, no hacer nada
    IF v_last_activity = v_today THEN
        RETURN NEW;
    END IF;

    -- LÓGICA OPTIMIZADA DE RACHA
    -- Solo necesitamos verificar:
    -- 1. Si la última actividad fue ayer = continuar racha
    -- 2. Si fue anteayer (día de gracia) = continuar racha
    -- 3. Si fue hace más tiempo = reiniciar a 1

    IF v_last_activity = v_yesterday THEN
        -- Actividad ayer, incrementar racha
        v_current_streak := v_current_streak + 1;
    ELSIF v_last_activity = v_yesterday - INTERVAL '1 day' THEN
        -- Día de gracia (anteayer), incrementar racha
        v_current_streak := v_current_streak + 1;
    ELSE
        -- Racha rota, reiniciar
        v_current_streak := 1;
    END IF;

    -- Actualizar registro
    UPDATE user_streaks
    SET
        current_streak = v_current_streak,
        longest_streak = GREATEST(longest_streak, v_current_streak),
        last_activity_date = v_today,
        updated_at = NOW()
    WHERE user_id = v_user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para ejecutar la función al insertar en tests
DROP TRIGGER IF EXISTS update_streak_on_test ON tests;
CREATE TRIGGER update_streak_on_test
    AFTER INSERT ON tests
    FOR EACH ROW
    WHEN (NEW.is_completed = true)
    EXECUTE FUNCTION update_user_streak_optimized();

-- Función para recalcular rachas históricas (solo para corrección inicial)
CREATE OR REPLACE FUNCTION recalculate_all_streaks()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_check_date DATE;
    v_grace_days INTEGER;
    v_has_activity BOOLEAN;
BEGIN
    -- Para cada usuario con tests
    FOR user_record IN
        SELECT DISTINCT user_id
        FROM tests
        WHERE is_completed = true
    LOOP
        v_current_streak := 0;
        v_longest_streak := 0;
        v_grace_days := 0;

        -- Calcular racha actual (sin límite de 60 días)
        FOR i IN 0..999 LOOP -- Hasta 1000 días atrás
            v_check_date := CURRENT_DATE - i;

            -- Verificar si hay actividad en este día
            SELECT EXISTS(
                SELECT 1 FROM tests
                WHERE user_id = user_record.user_id
                AND DATE(created_at) = v_check_date
                AND is_completed = true
            ) INTO v_has_activity;

            IF v_has_activity THEN
                v_current_streak := v_current_streak + 1;
                v_grace_days := 0;
            ELSE
                v_grace_days := v_grace_days + 1;
                IF v_grace_days > 1 THEN
                    -- Racha rota
                    EXIT;
                END IF;
            END IF;
        END LOOP;

        -- Actualizar o insertar
        INSERT INTO user_streaks (
            user_id,
            current_streak,
            longest_streak,
            last_activity_date
        ) VALUES (
            user_record.user_id,
            v_current_streak,
            v_current_streak, -- Por ahora igual, luego se puede mejorar
            (SELECT MAX(DATE(created_at)) FROM tests
             WHERE user_id = user_record.user_id AND is_completed = true)
        )
        ON CONFLICT (user_id) DO UPDATE
        SET
            current_streak = EXCLUDED.current_streak,
            longest_streak = GREATEST(user_streaks.longest_streak, EXCLUDED.current_streak),
            last_activity_date = EXCLUDED.last_activity_date,
            updated_at = NOW();

        RAISE NOTICE 'Usuario % - Racha: % días',
            user_record.user_id::text::substring(1, 8), v_current_streak;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Ejecutar recálculo para corregir rachas actuales
-- NOTA: Comentar después de ejecutar una vez
-- SELECT recalculate_all_streaks();

-- Verificar resultado para Nila
SELECT
    u.display_name,
    s.current_streak,
    s.longest_streak,
    s.last_activity_date
FROM user_streaks s
JOIN public_user_profiles u ON s.user_id = u.id
WHERE u.display_name = 'Nila';