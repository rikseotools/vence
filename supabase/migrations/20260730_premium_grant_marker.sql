-- Premium concedido a mano: hacerlo EXPLÍCITO para poder detectar el que no lo es.
--
-- ## El caso que lo motiva (investigado el 29/07/2026)
--
-- Un cliente canceló su suscripción DESDE LA APP el 26/05 (cancellation_feedback: self_service),
-- Stripe la terminó el 27/05 al acabar el mes pagado… y su fila en `user_subscriptions` se quedó
-- en `active` y su perfil en `premium`. Dos meses y 293 tests con premium regalado. Encaja con el
-- incidente del webhook roto del 26-27/05 (los eventos de Stripe caducan a los 30 días, así que
-- ya no se puede probar la no-entrega; la observabilidad tampoco existía hasta el 29/06).
--
-- **No lo detectó nada**, y no por descuido puntual: las 8 reglas de alerta sobre suscripciones
-- vigilan que ningún usuario se quede sin lo que pagó, o que la maquinaria funcione. NINGUNA
-- vigilaba lo contrario. Y el Pass-1 lo empeoraba: como la fila decía `active`, cada hora volvía
-- a poner el perfil en premium. La auto-reparación trabajaba a favor de la fuga.
--
-- ## Por qué esta columna es el PRIMER paso y no un adorno
--
-- Hoy `plan_type='premium'` sin suscripción significa dos cosas incompatibles: una concesión
-- legítima (la cuenta de Nila, la de Manuel, el canario `smoke@vence.es`) o una fuga. Son
-- indistinguibles desde los datos, así que cualquier detector chillaría con las tres cuentas
-- sanas todos los días — y un aviso que se enciende siempre por algo sano se acaba ignorando,
-- que es exactamente cómo murió el test que habría cazado esto.
--
-- ## Lo que esto NO arregla (dicho a propósito)
--
-- `plan_type` sigue siendo un valor DERIVADO que se guarda a mano, con 6 caminos que lo escriben
-- y 81 que lo leen. La cura de fondo es deducir el acceso de los hechos (suscripciones vigentes +
-- concesiones vigentes), como ya se hizo con `questions.is_active GENERATED` sobre
-- `lifecycle_state`: ahí la desincronización es IMPOSIBLE, no vigilada. Eso va en tarea propia.
-- Esta columna hace falta igual en ese diseño: la concesión manual es un hecho de primera clase.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS premium_grant_reason text,
  ADD COLUMN IF NOT EXISTS premium_granted_at   timestamptz,
  ADD COLUMN IF NOT EXISTS premium_granted_by   text;

COMMENT ON COLUMN public.user_profiles.premium_grant_reason IS
  'Por qué este usuario tiene premium SIN suscripción de pago (cuenta interna, canario, compensación, colaborador). NULL + premium sin suscripción activa = fuga, y así lo reporta subscription-reconciliation.';
COMMENT ON COLUMN public.user_profiles.premium_granted_at IS
  'Cuándo se concedió. Permite caducar concesiones temporales en vez de que se queden para siempre por olvido.';
COMMENT ON COLUMN public.user_profiles.premium_granted_by IS
  'Quién lo concedió (email o sistema). Sin esto, dentro de seis meses nadie sabe si aquella concesión sigue teniendo sentido.';

-- El detector consulta "premium sin suscripción y sin concesión" en cada pasada del cron horario.
CREATE INDEX IF NOT EXISTS user_profiles_premium_sin_concesion_idx
  ON public.user_profiles (plan_type)
  WHERE plan_type = 'premium' AND premium_grant_reason IS NULL;
