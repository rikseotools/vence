-- Migration: v_attribution_coverage deja de depender de auth.users
-- Fecha: 2026-06-26
-- Roadmap: docs/roadmap/auth-agnostico-jwks-y-rls.md §"Qué seguiría rompiendo el swap" punto 9.
--
-- POR QUÉ: la vista hacía `FROM auth.users` (schema de GoTrue, NO existe en Neon/RDS).
-- user_profiles.id == auth.users.id (mismo UUID) y tiene created_at → fuente equivalente
-- y portable. Quita un blocker de esquema para el swap a RDS, de forma anticipada y segura.
--
-- IMPACTO (verificado 2026-06-26 contra prod): con_canal (usuarios atribuidos) IDÉNTICO
-- (1941=1941). altas baja 8791→8783 (8 usuarios en auth.users SIN user_profiles, históricos
-- y sin atribución → salían en sin_atribucion). La cobertura queda más precisa, no menos.
--
-- ROLLBACK: re-crear la vista con `FROM auth.users u LEFT JOIN user_acquisition ua ON ua.user_id = u.id`
-- (válido solo mientras auth.users exista).

CREATE OR REPLACE VIEW public.v_attribution_coverage AS
SELECT up.created_at::date AS dia,
       count(*) AS altas,
       count(ua.user_id) AS con_canal,
       round(100.0 * count(ua.user_id)::numeric / NULLIF(count(*), 0)::numeric, 1) AS pct_cobertura,
       count(*) FILTER (WHERE ua.channel = 'google_ads'::text) AS google_ads,
       count(*) FILTER (WHERE ua.channel = 'meta_ads'::text) AS meta_ads,
       count(*) FILTER (WHERE ua.channel = 'organic'::text) AS organic,
       count(*) FILTER (WHERE ua.channel = 'direct'::text) AS direct,
       count(*) FILTER (WHERE ua.user_id IS NULL) AS sin_atribucion
FROM public.user_profiles up
LEFT JOIN public.user_acquisition ua ON ua.user_id = up.id
GROUP BY (up.created_at::date);
