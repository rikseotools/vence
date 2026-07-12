-- Vista de USO de features avanzadas del configurador por plan (free vs premium).
-- Responde: "¿qué features usan MUCHO los free?" → candidatas a gatear como premium.
-- Fuente: conversion_events event_type='config_features_used' (1 por test creado, con el
-- array de features activas + plan). Desanida las features y agrega por feature × plan.
--   SELECT * FROM v_config_feature_usage WHERE plan='free' ORDER BY uses DESC;
CREATE OR REPLACE VIEW public.v_config_feature_usage AS
SELECT
  feat.feature,
  ev.event_data->>'plan' AS plan,
  COUNT(*)::int                    AS uses,
  COUNT(DISTINCT ev.user_id)::int  AS users,
  MAX(ev.created_at)               AS last_used
FROM public.conversion_events ev
CROSS JOIN LATERAL jsonb_array_elements_text(ev.event_data->'features') AS feat(feature)
WHERE ev.event_type = 'config_features_used'
GROUP BY feat.feature, ev.event_data->>'plan'
ORDER BY uses DESC;

COMMENT ON VIEW public.v_config_feature_usage IS
  'Uso de features del configurador por feature x plan (free/premium). Fuente: conversion_events config_features_used. Decide que gatear: free que usan mucho = candidata. Ver docs/runbooks/premium-gating.md';
