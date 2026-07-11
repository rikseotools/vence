-- 20260711_active_signup_reward.sql
-- Recompensa "REGISTRO ACTIVO" para embajadores (decisión Manuel 11/07): bonus (2€) cuando un
-- REFERIDO llega a >=5 tests completados (señal de opositor real, no bot). Inversión temporal de
-- captación/marca (1-2 años), sunset-eable. ADITIVA y reversible.
--
-- El pago solo ocurre con ACTIVE_SIGNUP_REWARD=1 (flag de runtime) vía la lógica de app; esta
-- migración solo añade el ALMACÉN y expone la fuente en la vista de ingresos.

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS active_reward_at timestamptz,
  ADD COLUMN IF NOT EXISTS active_reward_amount numeric;

COMMENT ON COLUMN public.referrals.active_reward_at IS
  'Cuándo se concedió el bonus de registro activo (referido con >=5 tests) al embajador. NULL = no concedido. 1 por referido (idempotente por la fila).';

-- reward_earnings: añade la fuente 'registro_activo' (bonus por referido activo), junto a
-- 'referido' (venta) y las de reward_submissions (bug/ugc).
CREATE OR REPLACE VIEW public.reward_earnings AS
  SELECT r.referrer_user_id AS user_id, 'referido'::text AS source, r.bounty_amount AS amount, r.status, r.qualified_at AS earned_at
  FROM public.referrals r
  WHERE r.status = ANY (ARRAY['qualified'::text, 'payable'::text, 'paid'::text])
UNION ALL
  SELECT r.referrer_user_id AS user_id, 'registro_activo'::text AS source, r.active_reward_amount::numeric(10,2) AS amount, 'granted'::text AS status, r.active_reward_at AS earned_at
  FROM public.referrals r
  WHERE r.active_reward_at IS NOT NULL
UNION ALL
  SELECT s.user_id, s.type AS source, s.amount, s.status, s.created_at AS earned_at
  FROM public.reward_submissions s
  WHERE s.status = ANY (ARRAY['approved'::text, 'paid'::text]);
