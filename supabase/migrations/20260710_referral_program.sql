-- Programa de Referidos / Embajadores — tablas base (Fase 1 MVP).
--
-- Diseño completo: docs/roadmap/programa-referidos-embajadores.md (Anexo A).
-- Reglas de negocio (2026-07-10): refiere solo PREMIUM; bounty 10 € en gift card de Amazon
-- (cripto de wallets viejas, Bitrefill/Coinsbee) por cada usuario que NUNCA ha pagado (registro
-- nuevo o free existente) que paga en <=10 días desde la atribución; el referido recibe 5 € de
-- descuento (cupón Stripe en cuenta Nila). Pago por conversión, sin acumular, con hold de 5 días
-- (= ventana de reembolso) + clawback para chargebacks. Excluye ex-premium.
--
-- Migración ADDITIVA e IDEMPOTENTE (CREATE ... IF NOT EXISTS + guardas). No toca tablas vivas.
-- Acceso server-side vía Drizzle (getAdminDb/getReadDb) — sin RLS (línea agnóstica, no PostgREST).
-- Tras aplicar: regenerar db/schema.ts con `npx drizzle-kit introspect`.

-- 1) referral_codes — un código por embajador (premium). Token opaco; vanity opcional en Fase 2.
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  code          text NOT NULL UNIQUE,
  tier          text NOT NULL DEFAULT 'premium',
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.referral_codes IS
  'Código de referido por embajador (Fase 1: solo premium). code = token opaco; vanity opcional Fase 2.';

-- 2) referrals — una fila por usuario referido (first-touch: unique referred_user_id).
CREATE TABLE IF NOT EXISTS public.referrals (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id       uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  referred_user_id       uuid UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  code                   text NOT NULL,
  status                 text NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','qualified','payable','paid','rejected','expired')),
  attributed_at          timestamptz NOT NULL DEFAULT now(),
  qualified_at           timestamptz,
  plan_type              text,
  qualifying_payment_ref text,
  hold_until             timestamptz,
  bounty_amount          numeric(10,2) NOT NULL DEFAULT 10,
  discount_applied       boolean NOT NULL DEFAULT false,
  payout_id              uuid,   -- FK -> referral_payouts (añadida abajo tras crear esa tabla)
  fraud_flags            jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self CHECK (referred_user_id IS NULL OR referred_user_id <> referrer_user_id)
);
COMMENT ON TABLE public.referrals IS
  'Atribución + estado de cada referido. status: pending->qualified->payable->paid | rejected | expired. '
  'El reloj de <=10 días cuenta desde attributed_at (NO desde el registro). hold_until = pago + 5 días.';

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status   ON public.referrals (status);
-- para el job que promueve qualified->payable al vencer el hold:
CREATE INDEX IF NOT EXISTS idx_referrals_hold     ON public.referrals (status, hold_until);

-- 3) referral_payouts — gift cards compradas (manual en MVP).
CREATE TABLE IF NOT EXISTS public.referral_payouts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount           numeric(10,2) NOT NULL,
  method           text NOT NULL DEFAULT 'amazon_giftcard',
  purchased_via    text,   -- bitrefill | coinsbee | cardstorm | ...
  giftcard_ref     text,   -- referencia parcial/cifrada de la tarjeta (no guardar el código en claro)
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','void')),
  approved_by      uuid REFERENCES public.user_profiles(id),
  paid_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.referral_payouts IS
  'Payout de bounty en gift card de Amazon (Bitrefill/Coinsbee, cripto). Aprobación manual en Fase 1.';

CREATE INDEX IF NOT EXISTS idx_referral_payouts_referrer ON public.referral_payouts (referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_payouts_status   ON public.referral_payouts (status);

-- FK referrals.payout_id -> referral_payouts.id (idempotente).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'referrals_payout_fk') THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_payout_fk
      FOREIGN KEY (payout_id) REFERENCES public.referral_payouts(id) ON DELETE SET NULL;
  END IF;
END $$;
