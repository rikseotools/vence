-- Vista unificada de INGRESOS del embajador — capa escalable.
-- Hoy hay 3 fuentes (referido/bug/ugc) en 2 tablas; en el futuro se añadirán más. Esta vista las
-- unifica en (user_id, source, amount, status, earned_at) para que TODAS las stats (saldo, desglose
-- por fuente, total ganado) salgan de un único sitio. Añadir una fuente futura = 1 rama UNION aquí.
-- Idempotente (CREATE OR REPLACE).

CREATE OR REPLACE VIEW public.reward_earnings AS
  -- Fuente: REFERIDOS (bounty). Cuenta lo ganado (calificado en adelante, aunque esté en hold).
  SELECT
    r.referrer_user_id AS user_id,
    'referido'::text    AS source,
    r.bounty_amount     AS amount,
    r.status            AS status,
    r.qualified_at      AS earned_at
  FROM public.referrals r
  WHERE r.status IN ('qualified', 'payable', 'paid')

  UNION ALL

  -- Fuente: BUG / UGC (reward_submissions). El `type` es la fuente (bug|ugc|…futuras).
  SELECT
    s.user_id        AS user_id,
    s.type           AS source,
    s.amount         AS amount,
    s.status         AS status,
    s.created_at     AS earned_at
  FROM public.reward_submissions s
  WHERE s.status IN ('approved', 'paid');

COMMENT ON VIEW public.reward_earnings IS
  'Ingresos del embajador unificados por fuente (referido/bug/ugc/…). Capa escalable: añadir una '
  'fuente futura = añadir una rama UNION ALL. Lo consumen las stats del panel del embajador.';
