-- 20260604_seguidas_backfill_y_autoadd.sql
-- Fase 8 — favoritas desde la actividad real del usuario.
--
-- (A1) BACKFILL GLOBAL: cada oposición que un usuario ha PRACTICADO (tests.
--      position_type) y que mapea al catálogo se añade como favorita. Así
--      reconstruimos las oposiciones por las que ha pasado, aunque no haya
--      histórico de cambios de target. ON CONFLICT DO NOTHING → no toca el
--      target actual ni duplica. ~1225 filas / 3476 usuarios (medido 04/06).
--
-- (A2) AUTO-ADD ONGOING: trigger en `tests` que, al crear un test de una
--      oposición nueva, la añade como favorita. EXCEPTION-SAFE: si algo falla,
--      RETURN NEW → el INSERT del test SIEMPRE prospera (no rompemos el hot
--      path de creación de tests pase lo que pase).
--
-- Mapeo: tests.position_type (guiones BAJOS) → oposiciones.slug (GUIONES).
-- SECURITY DEFINER: bypasa la RLS-lockdown de user_oposiciones_seguidas.
-- Idempotente. Reversible (DROP TRIGGER/FUNCTION).

-- ── (A1) Backfill global ──
INSERT INTO public.user_oposiciones_seguidas (user_id, oposicion_id, rol)
SELECT DISTINCT t.user_id, o.id, 'favorita'
FROM public.tests t
JOIN public.oposiciones o ON o.slug = replace(t.position_type, '_', '-')
WHERE t.position_type IS NOT NULL
  AND t.position_type <> ''
  AND t.user_id IS NOT NULL
ON CONFLICT (user_id, oposicion_id) DO NOTHING;

-- ── (A2) Trigger auto-add ──
CREATE OR REPLACE FUNCTION public.tg_test_autoadd_favorita()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oposicion_id uuid;
BEGIN
  IF NEW.user_id IS NULL OR NEW.position_type IS NULL OR NEW.position_type = '' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_oposicion_id
  FROM public.oposiciones
  WHERE slug = replace(NEW.position_type, '_', '-')
  LIMIT 1;

  IF v_oposicion_id IS NOT NULL THEN
    INSERT INTO public.user_oposiciones_seguidas (user_id, oposicion_id, rol)
    VALUES (NEW.user_id, v_oposicion_id, 'favorita')
    ON CONFLICT (user_id, oposicion_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- El auto-add NO es crítico: nunca debe abortar la creación del test.
  -- PERO no lo tragamos en silencio: RAISE WARNING (nivel WARNING NO aborta el
  -- statement) deja rastro en los logs de Postgres → detectable. Complementado
  -- por la query de reconciliación (favoritas faltantes vs tests) para drift.
  RAISE WARNING 'tg_test_autoadd_favorita falló user=% position_type=%: %',
    NEW.user_id, NEW.position_type, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_tests_autoadd_favorita ON public.tests;
CREATE TRIGGER tg_tests_autoadd_favorita
  AFTER INSERT ON public.tests
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_test_autoadd_favorita();

COMMENT ON FUNCTION public.tg_test_autoadd_favorita() IS
  'Fase 8: al crear un test, añade su oposición (position_type→slug) como favorita. EXCEPTION-SAFE: nunca rompe el INSERT de tests.';
