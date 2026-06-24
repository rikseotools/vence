-- Preferencia de cuenta: mostrar las flechitas de tendencia (▲/▼ de los últimos
-- 30 días) junto al % de acierto en la lista del temario.
-- Aditiva: default true (visible). El % de acierto y su barra NO dependen de esto.
-- Espejo del patrón de show_daily_goal_banner (20260604_show_daily_goal_banner.sql).

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS show_topic_trend boolean NOT NULL DEFAULT true;
