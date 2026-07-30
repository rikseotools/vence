-- 20260730_device_daily_usage_por_huella.sql
--
-- El límite diario POR DISPOSITIVO deja de anclarse al `device_id` de localStorage.
--
-- ── QUÉ SE ARREGLA ──────────────────────────────────────────────────────────
-- El enforcement existe desde el 17/04/2026 (frontend + backend + tests + pantalla de bloqueo) y
-- en 30 días NO ha cortado ni una vez, mientras 3-11 dispositivos al día se pasan del tope. No
-- fallaba el bloqueo: fallaba el ANCLA. `get_device_daily_usage` agrupa por `device_id`, que vive
-- en `localStorage` y se borra en dos clics. Medido: el mismo trío de cuentas
-- (suusyyr / susanaborgesr / susistrawberryy) aparece bajo TRES `device_id` distintos, rotando de
-- cuenta cada 15 minutos — 25+25+25 = 75 preguntas con un tope de 25.
--
-- ── POR QUÉ SOLO LAS HUELLAS v2 (`fp2_…`) ───────────────────────────────────
-- La huella v1 (`hw_…`) SÍ sobrevive al borrado, pero colisiona: hay valores `hw_…` compartidos por
-- 83 cuentas distintas (hash casero de 32 bits + canvas recortado a su parte constante). Agrupar
-- por v1 no sería enforcement, sería un apagón para decenas de usuarias legítimas que solo comparten
-- modelo de móvil. Por eso esta función IGNORA `hw_%` a propósito: es una decisión de seguridad, no
-- un olvido. La v2 es SHA-256 sobre canvas completo + WebGL + audio + RAM + CPU.
--
-- ── ADITIVA POR DISEÑO ──────────────────────────────────────────────────────
-- El conjunto de cuentas es la UNIÓN de las que comparten `device_id` y las que comparten huella v2.
-- Nunca puede contar MENOS que la función actual, así que encenderla no puede dejar pasar a nadie
-- que hoy se bloquee. Y se crea con nombre nuevo: la vieja sigue en su sitio hasta que el código
-- llame a esta, lo que permite desplegar y revertir sin tocar la base.

CREATE OR REPLACE FUNCTION public.get_device_daily_usage_v2(
  p_device_id   text,
  p_fingerprint text DEFAULT NULL
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
  BEGIN
    v_today := (NOW() AT TIME ZONE 'Europe/Madrid')::DATE;

    -- Solo se agrupa por huella si es v2. Ver la nota de arriba sobre las colisiones de `hw_`.
    v_fp := CASE WHEN p_fingerprint LIKE 'fp2\_%' THEN p_fingerprint ELSE NULL END;

    -- Sin ninguna señal utilizable no se opina: 0 deja pasar (fail-open), que es el
    -- comportamiento correcto cuando no se sabe de quién es el dispositivo.
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
             (p_device_id IS NOT NULL AND ud.device_id = p_device_id)
             OR
             (v_fp IS NOT NULL AND ud.hw_fingerprint = v_fp)
           )
      );

    RETURN v_total;
  END;
$function$;

COMMENT ON FUNCTION public.get_device_daily_usage_v2(text, text) IS
  'Consumo diario agregado del dispositivo, anclado a la huella de hardware v2 (fp2_) además del '
  'device_id. Ignora las huellas v1 (hw_) a propósito: colisionan hasta 83 cuentas. T-304.';

-- Índice para el nuevo camino de búsqueda. Parcial: solo las huellas v2, que son las que se
-- consultan; las v1 no entran en la función y no merecen ocupar índice.
CREATE INDEX IF NOT EXISTS idx_user_devices_hw_fp_v2
  ON public.user_devices (hw_fingerprint)
  WHERE hw_fingerprint LIKE 'fp2\_%';
