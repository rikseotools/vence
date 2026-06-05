-- 20260605_attribution_observability_views.sql
-- Observabilidad de atribución (gap "todo debe estar observable"):
--   1) v_attribution_coverage: cobertura de canal por día (% de altas con
--      user_acquisition). Sirve para VER que el fix de cobertura sube al ~100%
--      y para un cron/alerta si cae. Reemplaza el cálculo manual ad-hoc.
--   2) v_campaign_revenue: ingreso real por campaña (lado revenue del ROAS).
--      El coste viene de la API de Google Ads (ads:roi); un panel/cron cruza
--      ambos. Base escalable de F2.
--
-- Solo lectura (VIEWs). getAdminDb las consulta. Idempotente (CREATE OR REPLACE).

CREATE OR REPLACE VIEW public.v_attribution_coverage AS
SELECT u.created_at::date                                        AS dia,
       count(*)                                                  AS altas,
       count(ua.user_id)                                         AS con_canal,
       round(100.0 * count(ua.user_id) / NULLIF(count(*), 0), 1) AS pct_cobertura,
       count(*) FILTER (WHERE ua.channel = 'google_ads')         AS google_ads,
       count(*) FILTER (WHERE ua.channel = 'meta_ads')           AS meta_ads,
       count(*) FILTER (WHERE ua.channel = 'organic')            AS organic,
       count(*) FILTER (WHERE ua.channel = 'direct')             AS direct,
       count(*) FILTER (WHERE ua.user_id IS NULL)                AS sin_atribucion
FROM auth.users u
LEFT JOIN public.user_acquisition ua ON ua.user_id = u.id
GROUP BY 1;

COMMENT ON VIEW public.v_attribution_coverage IS
  'Fase atribución: cobertura de canal por día (% de altas con user_acquisition) + desglose. Observabilidad del fix de cobertura. Consultar por getAdminDb.';

CREATE OR REPLACE VIEW public.v_campaign_revenue AS
SELECT COALESCE(ua.last_utm_campaign, ua.utm_campaign)  AS campaign_id,
       count(*)                                          AS ventas,
       sum((ce.event_data->>'amount')::numeric)          AS ingreso,
       min(ce.created_at)::date                          AS primera_venta,
       max(ce.created_at)::date                          AS ultima_venta
FROM public.conversion_events ce
JOIN public.user_acquisition ua ON ua.user_id = ce.user_id
WHERE ce.event_type = 'payment_completed'
  AND COALESCE(ua.last_utm_campaign, ua.utm_campaign) IS NOT NULL
GROUP BY 1;

COMMENT ON VIEW public.v_campaign_revenue IS
  'Fase atribución (F2): ingreso real por campaña (utm_campaign = id numérico de Google Ads). Lado revenue del ROAS; el coste viene de la API de Ads. Se poblará según compren usuarios ya atribuidos.';
