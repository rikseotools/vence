-- Pago ACUMULADO: un reward_payout puede cubrir saldo mixto (referido/bug/ugc) en una gift card de
-- denominación fija de Amazon.es. Se añade el reason 'accumulated' al CHECK de reward_payouts.
-- Diseño: docs/roadmap/programa-referidos-embajadores.md. Idempotente.

ALTER TABLE public.reward_payouts DROP CONSTRAINT IF EXISTS reward_payouts_reason_chk;
ALTER TABLE public.reward_payouts
  ADD CONSTRAINT reward_payouts_reason_chk
  CHECK (reason IN ('referral', 'bug', 'ugc', 'accumulated'));
