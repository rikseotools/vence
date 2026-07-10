-- Badge de "ganancias sin ver" del embajador: cuándo vio por última vez sus ganancias.
-- Las novedades sin ver = referidos qualified/payable/paid con qualified_at > este timestamp.
-- Preferencia de CUENTA (server-side, igual en todos los dispositivos). Additiva, idempotente.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS referral_earnings_seen_at timestamptz;

COMMENT ON COLUMN public.user_profiles.referral_earnings_seen_at IS
  'Última vez que el embajador vio sus ganancias del programa (para el badge de novedades). null = nunca visto.';
