-- Restaura el FK user_stats_summary.user_id → user_profiles(id) ON DELETE CASCADE
-- que se perdió en la migración Supabase→RDS (04/07/2026). Sin él, borrar un
-- usuario dejaba filas huérfanas de stats (se detectaron 57 el 08/07 vía
-- __tests__/api/user-stats/userStatsSummary.test.ts → "has CASCADE delete").
--
-- Additivo y seguro: tabla pequeña (~6.7k filas), la validación es sub-segundo.
-- Se limpian los huérfanos ANTES de crear la constraint (si no, ADD FK falla).

DELETE FROM user_stats_summary s
WHERE NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = s.user_id);

ALTER TABLE user_stats_summary
  DROP CONSTRAINT IF EXISTS user_stats_summary_user_id_fkey;

ALTER TABLE user_stats_summary
  ADD CONSTRAINT user_stats_summary_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
