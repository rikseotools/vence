-- 20260804_device_slot_inactivo_7_dias.sql
--
-- El slot de un dispositivo que ya no se usa deja de bloquear a su dueño a los 7 días.
--
-- ── POR QUÉ, MEDIDO EL 04/08/2026 ────────────────────────────────────────────────────────────
-- **35 de 289 premium (12%) toparon el límite de 2 dispositivos en 14 días**, con 183 respuestas
-- rechazadas. Al mirar QUIÉNES son, ninguno tiene pinta de cuenta repartida entre varias
-- personas —que es lo que este límite existe para frenar—: los pares son el equipo de UNA
-- persona (Android+Windows en 10 casos, Windows+Windows en 7, iPad+Mac, Mac+Mac…).
--
-- Y el hallazgo que decide el cambio: **de los 91 premium con los dos slots llenos, 39 tienen uno
-- ocupado por un aparato que ya no se usa**. Se ve por el patrón de RELEVO — el dispositivo viejo
-- deja de verse justo cuando nace el nuevo, que es la firma de la misma máquina re-registrándose
-- (navegador actualizado, datos borrados, otro perfil). A esas 39 personas no les limita el
-- número de aparatos que tienen: les limita un aparato suyo que ya no existe.
--
-- Decisión de Manuel (04/08/2026): *«los premium pueden tener ordenador y móvil, ya está; los
-- inactivos limpiarlos en 7 días»*. O sea: **el tope de 2 se queda** y lo que se libera es el
-- slot muerto. Subir el tope a 3 taparía el síntoma y dejaría el fantasma dentro (al tercer
-- re-registro se vuelve a estar igual) y abriría hueco real para compartir cuentas.
--
-- ── CÓMO SE IMPLEMENTA, Y POR QUÉ **NO** BORRANDO A LOS 7 DÍAS ───────────────────────────────
-- Lo obvio era bajar el DELETE de limpieza de 30 a 7 días. **Sería una regresión silenciosa del
-- antifraude:** `user_devices` no es solo el contador del límite — es la ÚNICA prueba de qué
-- cuentas comparten aparato, y el barrido de fraude mira hacia atrás **30 días**
-- (`FRAUD_WINDOW_DAYS`), igual que el cupo compartido del plan gratuito
-- (`get_device_daily_usage_v2`) y el anti-autoreferido. Borrar a los 7 les recortaría la ventana
-- de 30 a 7 sin que nadie lo pidiera: un multicuenta que rote de cuenta cada semana se volvería
-- invisible. Medido hoy: 5.620 filas quedan fuera de los 7 días.
--
-- Así que el slot se libera **sin borrar la prueba**: el límite cuenta solo los dispositivos
-- vistos en los últimos 7 días, y la fila se queda. El DELETE de limpieza sigue en 30 días, que
-- es housekeeping y coincide con la ventana que consumen los demás.
--
-- Recuperar el slot no le cuesta nada al usuario: al volver a usar ese aparato se re-registra
-- solo (y si es el mismo hardware, el PASO 2 reutiliza su fila en vez de gastar un hueco).
-- Impacto medido hoy: **670 usuarios con los dos slots llenos recuperan al menos uno**.

CREATE OR REPLACE FUNCTION public.register_device(p_user_id uuid, p_device_id text, p_device_label text DEFAULT NULL::text, p_hw_fingerprint text DEFAULT NULL::text)
 RETURNS TABLE(allowed boolean, device_count integer, max_devices integer, is_new_device boolean, is_premium boolean, existing_devices text)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
    DECLARE
      v_plan_type TEXT;
      v_is_premium BOOLEAN;
      v_max INTEGER;
      v_existing_id UUID;
      v_current_count INTEGER;
      v_is_new BOOLEAN := FALSE;
      v_device_labels TEXT;
      v_fp_match_id UUID;
      -- Cuánto tiene que llevar un aparato sin usarse para dejar de ocupar plaza (04/08/2026).
      v_slot_ttl INTERVAL := INTERVAL '7 days';
    BEGIN
      -- Limpieza: se queda en 30 días A PROPÓSITO. Estas filas son la prueba de qué cuentas
      -- comparten aparato y las leen el barrido de fraude, el cupo compartido del plan gratuito
      -- y el anti-autoreferido, todos con ventana de 30 días. Lo que se acorta es lo que OCUPA
      -- PLAZA (abajo), no lo que se recuerda.
      DELETE FROM user_devices
      WHERE user_id = p_user_id
        AND last_seen_at < NOW() - INTERVAL '30 days';

      -- Obtener plan del usuario
      SELECT up.plan_type INTO v_plan_type
      FROM user_profiles up
      WHERE up.id = p_user_id;

      v_is_premium := COALESCE(v_plan_type, 'free') IN ('premium', 'trial', 'legacy_free', 'premium_semester', 'admin');
      v_max := 2;

      -- PASO 1: ¿Este device_id ya está registrado?
      SELECT ud.id INTO v_existing_id
      FROM user_devices ud
      WHERE ud.user_id = p_user_id AND ud.device_id = p_device_id;

      IF v_existing_id IS NOT NULL THEN
        -- Dispositivo conocido: actualizar last_seen y fingerprint
        UPDATE user_devices
        SET last_seen_at = NOW(),
            device_label = COALESCE(p_device_label, device_label),
            hw_fingerprint = COALESCE(p_hw_fingerprint, hw_fingerprint)
        WHERE id = v_existing_id;
        SELECT COUNT(*)::INTEGER INTO v_current_count
        FROM user_devices WHERE user_id = p_user_id AND last_seen_at >= NOW() - v_slot_ttl;
        RETURN QUERY SELECT TRUE, v_current_count, v_max, FALSE, v_is_premium, ''::TEXT;
        RETURN;
      END IF;

      -- PASO 2: device_id nuevo — ¿hay un dispositivo con mismo fingerprint+label?
      -- Esto detecta localStorage regenerado: mismo hardware, nueva cookie.
      -- Solo si el fingerprint no es null (si no se envió, no deduplicar).
      IF p_hw_fingerprint IS NOT NULL THEN
        SELECT ud.id INTO v_fp_match_id
        FROM user_devices ud
        WHERE ud.user_id = p_user_id
          AND ud.hw_fingerprint = p_hw_fingerprint
          AND ud.device_label = p_device_label
        ORDER BY ud.last_seen_at DESC
        LIMIT 1;

        IF v_fp_match_id IS NOT NULL THEN
          -- Mismo hardware: reemplazar device_id viejo por el nuevo
          UPDATE user_devices
          SET device_id = p_device_id,
              last_seen_at = NOW(),
              device_label = COALESCE(p_device_label, device_label)
          WHERE id = v_fp_match_id;
          SELECT COUNT(*)::INTEGER INTO v_current_count
          FROM user_devices WHERE user_id = p_user_id AND last_seen_at >= NOW() - v_slot_ttl;
          RETURN QUERY SELECT TRUE, v_current_count, v_max, FALSE, v_is_premium, ''::TEXT;
          RETURN;
        END IF;
      END IF;

      -- PASO 3: Dispositivo realmente nuevo — verificar límite contando SOLO los que siguen vivos.
      SELECT COUNT(*)::INTEGER INTO v_current_count
      FROM user_devices WHERE user_id = p_user_id AND last_seen_at >= NOW() - v_slot_ttl;

      IF v_current_count >= v_max THEN
        -- En el mensaje solo se nombran los que de verdad ocupan plaza: enseñar un aparato que ya
        -- no cuenta le diría a alguien que desconecte algo que no le está bloqueando.
        SELECT string_agg(COALESCE(ud.device_label, 'Dispositivo desconocido'), ', ' ORDER BY ud.last_seen_at DESC)
        INTO v_device_labels
        FROM user_devices ud
        WHERE ud.user_id = p_user_id AND ud.last_seen_at >= NOW() - v_slot_ttl;

        RETURN QUERY SELECT FALSE, v_current_count, v_max, TRUE, v_is_premium, COALESCE(v_device_labels, '');
        RETURN;
      END IF;

      -- Registrar nuevo dispositivo
      INSERT INTO user_devices (user_id, device_id, device_label, hw_fingerprint)
      VALUES (p_user_id, p_device_id, p_device_label, p_hw_fingerprint);

      v_current_count := v_current_count + 1;
      v_is_new := TRUE;

      RETURN QUERY SELECT TRUE, v_current_count, v_max, v_is_new, v_is_premium, ''::TEXT;
    END;
    $function$;
