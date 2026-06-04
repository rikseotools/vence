-- 20260604_trigger_sync_seguidas.sql
-- Fase 8 — paso 8b: sincronización automática de user_oposiciones_seguidas
-- cuando el usuario cambia su target_oposicion.
--
-- POR QUÉ TRIGGER (decisión Manuel 04/06): el target se cambia por 3 caminos,
-- dos de ellos escriben user_profiles DIRECTO por Supabase REST desde el cliente
-- (OposicionChangeModal, OposicionContext.changeOposicion), saltándose el
-- servidor. Un trigger en user_profiles cubre LOS TRES sin tocar frontend ni
-- desplegar — invariante por construcción (mismo espíritu que is_active GENERATED
-- del lifecycle de preguntas).
--
-- Comportamiento: al cambiar target_oposicion →
--   1. El target anterior del usuario (si lo había) pasa a 'favorita' (no se
--      pierde: le seguirán llegando novedades por la campana).
--   2. El nuevo target, si mapea a una oposición del catálogo, se inserta/promueve
--      como 'target'. Mapeo: target_oposicion (position_type, guiones BAJOS) →
--      oposiciones.slug (GUIONES) vía replace('_','-').
--   3. Si el nuevo target NO mapea (UUID de custom_oposiciones, JSON legacy,
--      position_type sin landing) → solo se degrada el anterior; no hay oposición
--      del catálogo que seguir.
--
-- SECURITY DEFINER + search_path fijo: la función corre como su OWNER (admin),
-- así bypasa la RLS-lockdown de user_oposiciones_seguidas aunque el UPDATE de
-- user_profiles venga del rol `authenticated` (path REST cliente). Sin esto, la
-- RLS sin políticas bloquearía la escritura y abortaría el cambio de target.
--
-- AGNÓSTICO: PL/pgSQL estándar, válido en RDS. Idempotente. Reversible (drop).

CREATE OR REPLACE FUNCTION public.sync_user_oposiciones_seguidas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_oposicion_id uuid;
BEGIN
  -- En UPDATE, solo actuar si target_oposicion realmente cambió.
  IF TG_OP = 'UPDATE'
     AND NEW.target_oposicion IS NOT DISTINCT FROM OLD.target_oposicion THEN
    RETURN NEW;
  END IF;

  -- Mapear el nuevo target → oposiciones.id (NULL si no mapea al catálogo).
  IF NEW.target_oposicion IS NOT NULL AND NEW.target_oposicion <> '' THEN
    SELECT o.id INTO v_new_oposicion_id
    FROM public.oposiciones o
    WHERE o.slug = replace(NEW.target_oposicion, '_', '-')
    LIMIT 1;
  END IF;

  -- 1. Degradar el target actual (cualquiera que NO sea el nuevo) → favorita.
  UPDATE public.user_oposiciones_seguidas
     SET rol = 'favorita', updated_at = now()
   WHERE user_id = NEW.id
     AND rol = 'target'
     AND (v_new_oposicion_id IS NULL OR oposicion_id <> v_new_oposicion_id);

  -- 2. Upsert del nuevo target (si mapea a una oposición del catálogo).
  IF v_new_oposicion_id IS NOT NULL THEN
    INSERT INTO public.user_oposiciones_seguidas (user_id, oposicion_id, rol)
    VALUES (NEW.id, v_new_oposicion_id, 'target')
    ON CONFLICT (user_id, oposicion_id)
    DO UPDATE SET rol = 'target', updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_sync_user_oposiciones_seguidas ON public.user_profiles;
CREATE TRIGGER tg_sync_user_oposiciones_seguidas
  AFTER INSERT OR UPDATE OF target_oposicion ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_oposiciones_seguidas();

COMMENT ON FUNCTION public.sync_user_oposiciones_seguidas() IS
  'Fase 8: mantiene user_oposiciones_seguidas al cambiar user_profiles.target_oposicion (target saliente→favorita, nuevo→target). SECURITY DEFINER para bypasar RLS-lockdown desde el path REST cliente.';
