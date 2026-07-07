-- Multi-cuenta de pago: atribución de cuenta por usuario.
--
-- Contexto: la app pasa a operar N cuentas Stripe a la vez. Manuel gestiona
-- las renovaciones de lo existente; Nila las altas nuevas. Cada usuario/
-- suscripción necesita saber en qué cuenta vive para que cancelar/portal/
-- consultar/cupones usen el cliente correcto.
--
-- Nombre NEUTRO respecto al proveedor (payment_account, no stripe_account):
-- hoy los valores son cuentas de Stripe, pero deja la puerta abierta a otra
-- cuenta/proveedor sin renombrar (agnóstico by contract).
--
-- Additiva y NO destructiva. Postgres 11+ materializa el DEFAULT constante como
-- metadata (sin reescritura de tabla). Backfill implícito = 'manuel' (única
-- cuenta que ha existido hasta hoy), así que todo lo existente queda correcto.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS payment_account text NOT NULL DEFAULT 'manuel';

COMMENT ON COLUMN public.user_profiles.payment_account IS
  'Cuenta de pago donde vive la suscripción del usuario (multi-cuenta Stripe). '
  'Valores actuales: manuel (renovaciones histórico), nila (altas nuevas). '
  'Default manuel. Nombre neutro por si entra otro proveedor.';
