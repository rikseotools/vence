-- Migration: inscription_banner_dismissals
-- 2026-05-27
--
-- Tabla para persistir dismisses del banner "Inscripción abierta" por
-- usuario y oposición. Roadmap: docs/roadmap/banner-inscripcion-abierta.md.
--
-- Modelo: 1 fila por (user_id, oposicion_slug). Cuando el user pulsa la
-- X del banner, INSERT con boe_reference_at_dismiss = la convocatoria
-- vigente en ese momento. El endpoint GET excluye oposiciones con
-- dismiss cuyo boe_reference_at_dismiss == oposiciones.boe_reference
-- actual. Si la convocatoria cambia (nueva BOE), el dismiss queda
-- obsoleto y el banner vuelve a aparecer — comportamiento deseado:
-- nueva convocatoria = información nueva que el familiar/amigo no tenía.
--
-- Anónimos: no tocan esta tabla. Gestionan dismisses en localStorage
-- (key vence_dismissed_inscription_banners, array de slugs).
--
-- Rollback (5 segundos):
--   DROP TABLE IF EXISTS public.user_inscription_banner_dismissals;

CREATE TABLE IF NOT EXISTS public.user_inscription_banner_dismissals (
  user_id                    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  oposicion_slug             text NOT NULL,
  boe_reference_at_dismiss   text,
  dismissed_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, oposicion_slug)
);

-- Patrón de lectura del endpoint:
--   SELECT oposicion_slug, boe_reference_at_dismiss
--     FROM user_inscription_banner_dismissals
--    WHERE user_id = $1;
-- PK ya cubre este lookup (prefix-match user_id), no hace falta índice extra.

ALTER TABLE public.user_inscription_banner_dismissals ENABLE ROW LEVEL SECURITY;

-- Sin policies → anon/authenticated devuelve 0 filas con select directo.
-- El código server usa service_role (bypassa RLS) vía supabaseAdmin.
REVOKE ALL ON public.user_inscription_banner_dismissals FROM anon, authenticated;

COMMENT ON TABLE public.user_inscription_banner_dismissals IS
  'Dismisses del banner global "Inscripción abierta" por (user, oposición). '
  'INSERT al pulsar X. El endpoint excluye oposiciones cuyo dismiss tenga '
  'el mismo boe_reference que la convocatoria vigente — si cambia BOE, el '
  'dismiss se invalida y el banner vuelve a aparecer. '
  'Roadmap: docs/roadmap/banner-inscripcion-abierta.md.';

COMMENT ON COLUMN public.user_inscription_banner_dismissals.boe_reference_at_dismiss IS
  'BOE de la convocatoria que estaba activa cuando se dismisseó. NULL si '
  'la oposición no tenía boe_reference. Comparado con oposiciones.boe_reference '
  'en el endpoint para detectar nueva convocatoria y reactivar el banner.';
