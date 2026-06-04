-- 20260604_user_oposiciones_seguidas.sql
-- Fase 8 (roadmap deteccion-convocatorias-oeps-completo.md §Fase 8) — paso 8a.
--
-- Modelo "oposiciones seguidas" por usuario: target actual + favoritas.
-- Fuente única de "a quién avisar" cuando un hito relevante de una oposición
-- se verifica (campana + email). NO envía nada por sí misma; solo modela la
-- relación usuario↔oposición. Reversible.
--
-- Reglas de negocio:
--   - rol='target'    → la oposición que el usuario estudia AHORA (máx. 1/usuario).
--   - rol='favorita'  → oposiciones que sigue para enterarse de novedades.
--   - Al cambiar de target, el target anterior pasa a 'favorita' (lógica de app).
--   - notify_bell / notify_email: el usuario manda sobre los canales por oposición.
--
-- AGNÓSTICO A SUPABASE (migración a AWS/RDS en curso):
--   - Solo Postgres estándar (tabla + índices + FK + CHECK + RLS).
--   - SIN función RPC, SIN auth.uid(), SIN grants a authenticated/anon.
--   - RLS habilitado SIN políticas = lockdown total vía PostgREST; la conexión
--     privilegiada de la app (getAdminDb/Drizzle) bypasa RLS y es la única que
--     escribe/lee. En RDS (sin PostgREST) es inocuo.
--
-- Idempotente. Aplicar en prod solo tras revisión.

CREATE TABLE IF NOT EXISTS public.user_oposiciones_seguidas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  oposicion_id UUID NOT NULL REFERENCES public.oposiciones(id) ON DELETE CASCADE,
  rol          TEXT NOT NULL DEFAULT 'favorita' CHECK (rol IN ('target','favorita')),
  notify_bell  BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, oposicion_id)
);

COMMENT ON TABLE public.user_oposiciones_seguidas IS
  'Fase 8: oposiciones que sigue cada usuario (target actual + favoritas). Audiencia del fan-out de hitos verificados. Escritura vía endpoint+Drizzle, no RPC.';

-- Invariante por construcción: como mucho UN target por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_oposicion_target
  ON public.user_oposiciones_seguidas (user_id)
  WHERE rol = 'target';

-- Query de audiencia del fan-out: "quién sigue esta oposición con campana on".
CREATE INDEX IF NOT EXISTS idx_uos_oposicion_bell
  ON public.user_oposiciones_seguidas (oposicion_id)
  WHERE notify_bell;

CREATE INDEX IF NOT EXISTS idx_uos_user
  ON public.user_oposiciones_seguidas (user_id);

-- RLS lockdown (habilitado sin políticas).
ALTER TABLE public.user_oposiciones_seguidas ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────
-- BACKFILL — todo usuario con target_oposicion que mapea a una oposición del
-- catálogo entra como rol='target'. Mapeo: user_profiles.target_oposicion usa
-- guiones BAJOS (position_type, p.ej. 'auxiliar_administrativo_estado');
-- oposiciones.slug usa GUIONES ('auxiliar-administrativo-estado') → replace.
-- Se omiten los target que no mapean a una fila (UUIDs de custom_oposiciones,
-- JSON legacy, position_types sin landing) — no hay oposición que seguir.
-- ON CONFLICT DO NOTHING → re-ejecutable sin duplicar.
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO public.user_oposiciones_seguidas (user_id, oposicion_id, rol)
SELECT up.id, o.id, 'target'
FROM public.user_profiles up
JOIN public.oposiciones o
  ON o.slug = replace(up.target_oposicion, '_', '-')
WHERE up.target_oposicion IS NOT NULL
  AND up.target_oposicion <> ''
ON CONFLICT (user_id, oposicion_id) DO NOTHING;
