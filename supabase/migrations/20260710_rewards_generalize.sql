-- Generaliza el payout del programa a 3 tipos de recompensa (referral / bug / ugc).
-- Diseño: docs/roadmap/programa-referidos-embajadores.md (§2-ter, Anexo A.1).
--
-- 1) referral_payouts → reward_payouts: renombra + añade `reason`, `beneficiary_user_id`, `source_id`.
--    La tabla está VACÍA en prod (creada hoy) → rename + columnas sin riesgo de datos. La FK
--    referrals.payout_id sigue apuntando a la tabla renombrada automáticamente (Postgres).
-- 2) reward_submissions: envíos de bug/UX (3 €) y UGC/opinión (5 €). El referido usa `referrals`.
--
-- Idempotente (guardas de existencia). Aplicar tras 20260710_referral_program.sql.

-- 1) rename tabla (idempotente)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='referral_payouts')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='reward_payouts') THEN
    ALTER TABLE public.referral_payouts RENAME TO reward_payouts;
  END IF;
END $$;

-- 1b) rename columna referrer_user_id → beneficiary_user_id (idempotente)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reward_payouts' AND column_name='referrer_user_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reward_payouts' AND column_name='beneficiary_user_id') THEN
    ALTER TABLE public.reward_payouts RENAME COLUMN referrer_user_id TO beneficiary_user_id;
  END IF;
END $$;

-- 1c) nuevas columnas + check de reason
ALTER TABLE public.reward_payouts ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT 'referral';
ALTER TABLE public.reward_payouts ADD COLUMN IF NOT EXISTS source_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reward_payouts_reason_chk') THEN
    ALTER TABLE public.reward_payouts ADD CONSTRAINT reward_payouts_reason_chk
      CHECK (reason IN ('referral','bug','ugc'));
  END IF;
END $$;
COMMENT ON TABLE public.reward_payouts IS
  'Payout en gift card Amazon compartido por los 3 tipos de recompensa (reason: referral|bug|ugc). '
  'Aprobación manual en Fase 1; integración Bitrefill API en Fase 2.';

-- 2) reward_submissions — bug/UX (3 €) y UGC/opinión (5 €)
CREATE TABLE IF NOT EXISTS public.reward_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('bug','ugc')),
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','paid')),
  url           text,                 -- link del post/UGC (obligatorio en ugc)
  screenshot_url text,
  feedback_id   uuid,                 -- enlace al feedback existente (bug)
  amount        numeric(10,2) NOT NULL,
  hold_until    timestamptz,          -- ugc: se paga tras comprobar que el post sigue vivo
  payout_id     uuid REFERENCES public.reward_payouts(id) ON DELETE SET NULL,
  approved_by   uuid REFERENCES public.user_profiles(id),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.reward_submissions IS
  'Envíos de recompensa por bug/UX (3 €) y UGC/opinión genuina (5 €). Aprobación manual + topes por '
  'usuario/mes (UGC 3/mes). UGC: url+captura+hold (post vivo). Referido va en la tabla referrals.';

CREATE INDEX IF NOT EXISTS idx_reward_submissions_user   ON public.reward_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_reward_submissions_status ON public.reward_submissions (type, status);
