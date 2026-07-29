-- Ofertas de precio personalizadas (precio heredado).
--
-- POR QUÉ (caso Rocío, 29/07/2026): a una persona a la que le mantenemos su precio hay
-- que darle una forma de pagarlo. La primera versión fue un enlace de Stripe suelto
-- (`buy.stripe.com/...`), y tiene dos problemas: por marca (un enlace ajeno enviado por
-- mensaje parece phishing) y por seguridad (el endpoint de checkout acepta cualquier
-- `priceId` que le manden, así que ese precio bajo sería usable por cualquiera que lo
-- conociese).
--
-- Con esta tabla la oferta es un dato de la persona, no un secreto en una URL: la página
-- `/premium/personal` la lee, y el checkout comprueba que el precio pedido es SUYO.
CREATE TABLE IF NOT EXISTS public.user_price_offers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Price de Stripe con el importe pactado (creado por scripts/stripe/precio-heredado.cjs)
  stripe_price_id  text NOT NULL,
  stripe_account   text NOT NULL DEFAULT 'nila',
  importe_centimos integer NOT NULL CHECK (importe_centimos > 0),
  intervalo        text NOT NULL CHECK (intervalo IN ('mensual','trimestral','semestral','anual')),

  -- Para qué se concedió y de dónde sale (auditoría: esto es dinero)
  motivo           text NOT NULL,
  feedback_id      uuid REFERENCES public.user_feedback(id) ON DELETE SET NULL,
  creado_por       text NOT NULL DEFAULT 'soporte',

  -- Respaldo: el Payment Link de Stripe, por si hay que mandarlo por correo
  payment_link_url text,

  created_at       timestamptz NOT NULL DEFAULT now(),
  -- NULL = sin caducidad. Una oferta caducada NO se borra: queda como histórico.
  expires_at       timestamptz,
  -- Cuándo la usó (la deja de mostrar, pero se conserva)
  redeemed_at      timestamptz,
  -- Retirada a mano
  revoked_at       timestamptz
);

-- Una sola oferta VIVA por persona: si se le concede otra, primero se retira la anterior.
-- Sin esto, dos ofertas activas dejarían el precio a suerte de cuál lea la página.
CREATE UNIQUE INDEX IF NOT EXISTS user_price_offers_una_viva_por_usuario
  ON public.user_price_offers (user_id)
  WHERE redeemed_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS user_price_offers_price_idx
  ON public.user_price_offers (stripe_price_id);

COMMENT ON TABLE public.user_price_offers IS
  'Precio personalizado concedido a un usuario (precio heredado tras una subida de tarifa). Lo crea scripts/stripe/precio-heredado.cjs; lo leen /premium/personal y el guardia de /api/stripe/create-checkout.';
