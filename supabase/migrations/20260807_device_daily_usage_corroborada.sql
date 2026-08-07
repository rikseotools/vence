-- 20260807_device_daily_usage_corroborada.sql  ·  [T-657]
--
-- La huella de hardware deja de agrupar cuentas ELLA SOLA.
--
-- ── QUÉ SE ARREGLA ──────────────────────────────────────────────────────────
-- `get_device_daily_usage_v2` suma el cupo de todas las cuentas free que comparten `device_id`
-- **o** huella v2 (`fp2_…`). El problema es que la huella v2 no identifica un APARATO: identifica
-- un MODELO. Es un SHA-256 de canvas + WebGL + audio + RAM + núcleos, y dos móviles iguales con el
-- mismo Chrome producen el mismo valor. Medido el 07/08/2026 sobre 30 días:
--
--   · 125 huellas v2 compartidas por más de una cuenta → 369 cuentas agrupadas.
--   · La peor: 18 cuentas, 18 navegadores distintos, 15 ciudades distintas, 17 IPs distintas.
--   · Ese día, 59 cuentas free topaban el cupo del aparato SIN haber respondido nada (49 con cero).
--
-- Es el mismo fallo que ya tuvo la huella v1 —donde un hash corto llegó a juntar 83 cuentas— y que
-- se dio por resuelto al pasar a la v2. La v2 colisiona menos, pero colisiona.
--
-- ── QUÉ CAMBIA ──────────────────────────────────────────────────────────────
-- La huella pasa de ser PRUEBA a ser INDICIO: agrupa solo si algo la corrobora. Una cuenta ajena
-- entra en la suma si comparte el `device_id` (mismo navegador, prueba directa) **o** si comparte
-- huella Y ADEMÁS se ha visto conectada desde la MISMA IP en los últimos 30 días.
--
-- ── POR QUÉ LA IP, Y POR QUÉ SIGUE CAZANDO ──────────────────────────────────
-- Quien multiplica cuentas para estirar el cupo lo hace desde su casa: cambia de correo y borra el
-- `localStorage` (por eso el `device_id` no bastaba), pero no cambia de línea. Quien colisiona por
-- modelo de móvil está en otra provincia. Calibrado contra los dos lados antes de escribir esto:
--
--   · CONFIRMADOS a mano: el único con más de una cuenta comparte IP → se le sigue aplicando.
--     (El otro confirmado agrupa una sola cuenta, donde la huella no aporta nada: su propio
--      consumo ya lo cubre el límite por cuenta.)
--   · COLISIONES: de las 25 huellas más compartidas, 23 no comparten ni una IP → dejan de
--     agruparse. Las 2 que sí la comparten se conservan agrupadas, que es justo lo que se quiere.
--
-- ── ADITIVA Y REVERSIBLE ────────────────────────────────────────────────────
-- Nombre nuevo, la v2 se queda en su sitio: se puede desplegar y revertir sin tocar la base. Esta
-- versión nunca cuenta MÁS que la v2 (solo quita agrupaciones), así que no puede bloquear a nadie
-- que hoy no se bloquee.

-- La corroboración por IP se consulta en caliente. Sin índice, cada comprobación recorre las 101k
-- filas de `user_sessions`.
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip_user
  ON public.user_sessions (ip_address, user_id)
  WHERE ip_address IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_device_daily_usage_v3(
  p_device_id   text,
  p_fingerprint text DEFAULT NULL,
  p_ip          text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  DECLARE
    v_total INTEGER;
    v_today DATE;
    v_fp    text;
    v_ip    inet;
  BEGIN
    v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;

    -- Igual que en la v2: las huellas v1 (`hw_`) no se usan, colisionan hasta 83 cuentas.
    v_fp := CASE WHEN p_fingerprint LIKE 'fp2\_%' THEN p_fingerprint ELSE NULL END;

    -- `user_sessions.ip_address` es `inet`. La cabecera llega como texto y puede traer cualquier
    -- cosa, así que una IP que no parsea NO corrobora (y no revienta la consulta): sin IP válida
    -- la huella no agrupa, que es el lado seguro de equivocarse.
    BEGIN
      v_ip := p_ip::inet;
    EXCEPTION WHEN others THEN
      v_ip := NULL;
    END;

    -- Sin ninguna señal utilizable no se opina: fail-open.
    IF p_device_id IS NULL AND v_fp IS NULL THEN
      RETURN 0;
    END IF;

    SELECT COALESCE(SUM(dqu.questions_answered), 0) INTO v_total
    FROM daily_question_usage dqu
    INNER JOIN user_profiles up ON up.id = dqu.user_id
    WHERE dqu.usage_date = v_today
      AND COALESCE(up.plan_type, 'free') NOT IN
          ('premium', 'trial', 'legacy_free', 'premium_semester', 'admin')
      AND EXISTS (
        SELECT 1 FROM user_devices ud
         WHERE ud.user_id = dqu.user_id
           AND ud.last_seen_at > NOW() - INTERVAL '30 days'
           AND (
             -- (a) MISMO navegador: prueba directa, no necesita corroboración.
             (p_device_id IS NOT NULL AND ud.device_id = p_device_id)
             OR
             -- (b) Misma huella Y corroborada por IP compartida. Sin IP válida la huella NO agrupa
             --     por sí sola: es el punto entero de este cambio.
             (v_fp IS NOT NULL AND v_ip IS NOT NULL AND ud.hw_fingerprint = v_fp
              AND EXISTS (
                SELECT 1 FROM user_sessions s
                 WHERE s.user_id = ud.user_id
                   AND s.ip_address = v_ip
                   AND s.created_at > NOW() - INTERVAL '30 days'
              ))
           )
      );

    RETURN v_total;
  END;
$function$;

COMMENT ON FUNCTION public.get_device_daily_usage_v3(text, text, text) IS
  'Consumo diario agregado del dispositivo. La huella v2 solo agrupa cuentas si la corrobora una '
  'IP compartida: por sí sola identifica el MODELO de móvil, no el aparato (125 huellas / 369 '
  'cuentas colisionadas medidas el 07/08/2026). T-657.';
