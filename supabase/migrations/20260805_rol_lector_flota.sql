-- T-486 — `vence_lector`: los trabajadores pueden DIAGNOSTICAR sin poder cambiar ni identificar.
--
-- ── POR QUÉ, Y NO ES UNA AMPLIACIÓN CAPRICHOSA ──────────────────────────────────────────────
-- El rol `vence_coordinacion` (T-539) deja a un trabajador participar del reparto: reclamar,
-- latir, preguntar, entregar. Y ya está. La primera tarea real de la flota (T-476, 05/08) chocó
-- de frente con eso: de las cuatro alertas de salud que había que triar, **tres necesitaban LEER**
-- `observable_events`, `user_daily_stats` y `test_questions`. El trabajador lo comprobó con el
-- canario, no se lo inventó, y lo dejó escrito en el embudo.
--
-- No era mala suerte: **casi todo el trabajo que [T-486] declara apto** —barridos de salud,
-- auditorías de scope, generación de preguntas, adjudicaciones— es leer datos y proponer. Con solo
-- el rol de coordinación, la flota puede coordinarse pero apenas puede trabajar.
--
-- ── LA LÍNEA, Y POR QUÉ ESTÁ AHÍ ────────────────────────────────────────────────────────────
-- **Se deniega el IDENTIFICADOR DIRECTO. Se permite la ACTIVIDAD por `user_id`.**
--
-- Un trabajador necesita saber que el usuario `a3f2…` respondió 500 preguntas ayer para diagnosticar
-- una divergencia de contadores. No necesita —ni debe— saber que ese usuario se llama Fulano y su
-- correo es tal. Un UUID sin la tabla que lo traduce no dice quién es nadie.
--
-- Por eso la lista de abajo NO es «tablas que suenan sensibles»: es la enumeración de dónde vive un
-- correo, un nombre, un teléfono, una IP, un identificador de pago o un token de sesión. Las tablas
-- de CONTENIDO con columnas `name`/`nombre` (leyes, oposiciones, secciones, categorías) no entran:
-- ahí «nombre» es el de una ley, no el de una persona.
--
-- ── Y SIGUE SIN PODER ESCRIBIR NADA ─────────────────────────────────────────────────────────
-- Solo SELECT. Ni INSERT, ni UPDATE, ni DELETE, en ninguna tabla. Un trabajador puede diagnosticar,
-- auditar y PROPONER; aplicar lo propuesto sigue siendo de quien revisa.
--
-- Idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vence_lector') THEN
    CREATE ROLE vence_lector
      LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
      CONNECTION LIMIT 10;
  END IF;
END $$;

COMMENT ON ROLE vence_lector IS
  'T-486 — trabajadores de la flota: SOLO SELECT, y sin las tablas con identificadores directos (correo, nombre, teléfono, IP, pago, tokens). Contraseña en SSM.';

GRANT USAGE ON SCHEMA public TO vence_lector;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO vence_lector;

-- ── LO QUE NO PUEDE LEER, UNA A UNA Y CON SU MOTIVO ────────────────────────────────────────
-- Deliberadamente SIN `ALTER DEFAULT PRIVILEGES`: una tabla nueva NO queda legible sola. Cuesta un
-- grant explícito el día que haga falta, y a cambio una tabla nueva con datos personales no se
-- expone por el simple hecho de nacer. Se prefiere el error por defecto que no expone.
REVOKE SELECT ON
  -- correo, nombre o teléfono de una persona
  public.user_profiles,
  public.public_user_profiles,
  public.admin_users_with_roles,
  public.deleted_users_log,
  public.user_feedback,
  public.cancellation_feedback,
  public.plan_type_audit_log,
  public.user_stats_resets,
  public.user_oposiciones_seguidas,
  public.email_unsubscribe_tokens,
  public.telegram_session,
  -- dirección IP y contenido de correos enviados a personas
  public.email_events,
  public.notification_events,
  -- dinero: identificadores de Stripe y liquidaciones
  public.user_subscriptions,
  public.payment_settlements,
  public.payout_transfers,
  public.stripe_platform_fees,
  public.subscription_adjustments,
  public.user_price_offers,
  -- sesiones y credenciales
  public.user_sessions,
  -- señales de fraude: llevan huellas y hashes de correo
  public.fraud_confirmations
FROM vence_lector;

-- El supuesto sobre el que descansa todo esto se AFIRMA, no se da por hecho: si algún día se
-- concede algo a PUBLIC, el alcance del rol dejaría de ser el que dice este fichero.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM information_schema.role_table_grants
   WHERE grantee = 'PUBLIC' AND table_schema = 'public';
  IF n > 0 THEN
    RAISE EXCEPTION 'PUBLIC tiene % privilegio(s) sobre tablas de public: el alcance de vence_lector ya no es el declarado (T-486)', n;
  END IF;
END $$;
