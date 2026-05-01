-- 20260501: Configurar timeouts de BD para prevenir conexiones zombi
--
-- Problema: cuando Vercel mata una función serverless (30s timeout), la conexión
-- TCP con Supavisor queda abierta. PostgreSQL espera que el cliente lea el resultado
-- (estado ClientRead). Sin timeout, esa conexión ocupa 1 de 90 slots del pool
-- indefinidamente → cascada de 504s.
--
-- Fix: statement_timeout 30s mata queries antes de que Vercel las abandone.
-- idle_in_transaction_session_timeout 60s mata conexiones zombi en transacciones.

ALTER DATABASE postgres SET statement_timeout = '30s';
ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '60s';

-- También optimizado el trigger update_user_streak_function:
-- Guard que solo recalcula la racha 1 vez/día (antes: 15s por INSERT).
-- Ver migración 20260501_optimize_user_question_history_trigger.sql para
-- el otro trigger optimizado (eliminar JOIN tests).

CREATE OR REPLACE FUNCTION update_user_streak_function()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_new_streak INTEGER;
  v_today DATE;
  v_last_activity DATE;
BEGIN
  SELECT user_id INTO v_user_id FROM tests WHERE id = NEW.test_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;

  -- GUARD: solo recalcular si no hay actividad hoy todavía
  SELECT last_activity_date INTO v_last_activity
  FROM user_streaks WHERE user_id = v_user_id;

  IF v_last_activity IS NOT NULL AND v_last_activity >= v_today THEN
    RETURN NEW;
  END IF;

  v_new_streak := calculate_user_streak(v_user_id);

  INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date, streak_updated_at)
  VALUES (v_user_id, v_new_streak, v_new_streak, v_today, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = v_new_streak,
    longest_streak = GREATEST(user_streaks.longest_streak, v_new_streak),
    last_activity_date = v_today,
    streak_updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
