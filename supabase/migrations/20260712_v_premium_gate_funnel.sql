-- Vista del EMBUDO del gating premium por-feature (framework lib/premium/features.ts).
-- Mide, por cada feature gateada: cuántas veces se mostró el gate, cuántos pulsaron el CTA
-- "Hazte Premium", cuántos lo descartaron, usuarios distintos y CTR. Fuente: conversion_events
-- (event_data->>'feature'). Así se decide con DATOS qué gate convierte y cuál sobra.
--   SELECT * FROM v_premium_gate_funnel ORDER BY shown DESC;
CREATE OR REPLACE VIEW public.v_premium_gate_funnel AS
WITH ev AS (
  SELECT
    event_data->>'feature' AS feature,
    event_data->>'kind'    AS kind,
    event_type,
    user_id,
    created_at
  FROM public.conversion_events
  WHERE event_type IN ('premium_gate_shown', 'premium_gate_cta_click', 'premium_gate_dismiss')
    AND event_data->>'feature' IS NOT NULL
)
SELECT
  feature,
  MAX(kind) AS kind,
  COUNT(*) FILTER (WHERE event_type = 'premium_gate_shown')::int      AS shown,
  COUNT(*) FILTER (WHERE event_type = 'premium_gate_cta_click')::int  AS cta_click,
  COUNT(*) FILTER (WHERE event_type = 'premium_gate_dismiss')::int    AS dismiss,
  COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'premium_gate_shown')::int AS users_shown,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type = 'premium_gate_cta_click')
    / NULLIF(COUNT(*) FILTER (WHERE event_type = 'premium_gate_shown'), 0)
  , 1) AS cta_rate_pct,
  MAX(created_at) FILTER (WHERE event_type = 'premium_gate_shown') AS last_shown
FROM ev
GROUP BY feature
ORDER BY shown DESC;

COMMENT ON VIEW public.v_premium_gate_funnel IS
  'Embudo del gating premium por-feature (premium_gate_shown -> cta_click). Fuente: conversion_events. Ver docs/runbooks/premium-gating.md';
