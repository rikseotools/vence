-- Varias ofertas vivas por persona (29/07/2026).
--
-- El índice original permitía UNA sola: se pensó para "se le mantiene su precio". Pero el
-- caso real es elegir — a Rocío se le ofrecen su mensual de 18 € Y su trimestral de 35 €,
-- y que decida ella. Con una sola oferta viva había que retirarle una para darle la otra.
--
-- Lo que sí sigue sin poder repetirse es la MISMA oferta dos veces (mismo precio para la
-- misma persona), que es lo que de verdad crearía ambigüedad.
DROP INDEX IF EXISTS user_price_offers_una_viva_por_usuario;

CREATE UNIQUE INDEX IF NOT EXISTS user_price_offers_una_por_precio
  ON public.user_price_offers (user_id, stripe_price_id)
  WHERE redeemed_at IS NULL AND revoked_at IS NULL;
