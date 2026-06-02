-- 20260602_seo_keyword_targets_seed.sql
-- Seed inicial del tracker SEO: keywords objetivo (análisis competidor
-- testdeley.com 02/06/2026) + bitácora de acciones de hoy. Idempotente.
-- El primer snapshot de posición lo captura el cron /api/cron/seo-snapshot.

-- Keywords objetivo (ON CONFLICT por keyword → re-ejecutable sin duplicar).
INSERT INTO public.seo_keyword_targets
  (keyword, target_volume, search_intent, target_slug, priority, competitor, competitor_position, notes)
VALUES
  -- Tier 1
  ('ebep', 18100, 'informational', 'rdl-5-2015', 'tier1', 'testdeley.com', 43, 'EBEP/TREBEP. Mayor volumen del catálogo; testdeley mal posicionado = muy ganable.'),
  ('lprl', 5400, 'informational', 'lprl', 'tier1', 'testdeley.com', 45, 'Ley 31/1995 PRL. SSR via fallback de artículos (no tiene law_sections).'),
  ('test constitución española', 5400, 'commercial', 'constitucion-espanola', 'tier1', 'testdeley.com', 1, 'Magneto. Ya rankeamos ~p7.'),
  ('test de ley', 5400, 'commercial', NULL, 'tier1', 'testdeley.com', 1, 'Genérico, hub /leyes. testdeley homepage p1.'),
  ('test constitucion', 1600, 'commercial', 'constitucion-espanola', 'tier1', 'testdeley.com', NULL, NULL),
  ('test de leyes', 1000, 'commercial', NULL, 'tier1', 'testdeley.com', 1, 'Hub /leyes.'),
  -- Tier 2
  ('ley 50/1997', 3600, 'informational', 'ley-50-1997', 'tier2', 'testdeley.com', 43, 'Ley del Gobierno.'),
  ('ley del gobierno', 2900, 'informational', 'ley-50-1997', 'tier2', 'testdeley.com', 19, NULL),
  ('test ley 39/2015', 1900, 'commercial', 'ley-39-2015', 'tier2', 'testdeley.com', 2, 'KD bajo, muy ganable. Ya ~p6.4.'),
  ('9 2017', 1900, 'informational', 'ley-9-2017', 'tier2', 'testdeley.com', 31, 'Ley 9/2017 contratos. SSR via fallback de artículos.'),
  ('lo 3 2018', 1600, 'informational', 'lo-3-2018', 'tier2', 'testdeley.com', 64, 'LOPD. testdeley mal posicionado = ganable.'),
  ('ley 55/2003', 1600, 'navigational', 'ley-55-2003-estatuto-marco', 'tier2', 'testdeley.com', 60, 'Estatuto Marco. SSR via fallback de artículos.'),
  ('test ley 40/2015', 880, 'commercial', 'ley-40-2015', 'tier2', 'testdeley.com', 1, 'Ya ~p4.7.'),
  ('test ce', 418, 'commercial', 'constitucion-espanola', 'tier2', 'testdeley.com', NULL, 'Ya ~p4.1.'),
  -- Tier 3
  ('ley funcion publica andalucia', 1600, 'informational', NULL, 'tier3', 'testdeley.com', NULL, NULL),
  ('ley 17/2015', 1000, 'informational', NULL, 'tier3', 'testdeley.com', NULL, 'Sistema Nacional de Protección Civil.'),
  ('ley 23/2014', 1000, 'informational', NULL, 'tier3', 'testdeley.com', NULL, NULL)
ON CONFLICT (keyword) DO NOTHING;

-- Bitácora de acciones del 02/06/2026 (solo si no hay ya acciones de ese día).
INSERT INTO public.seo_actions (done_on, scope_type, scope_value, action_type, description, commit_sha)
SELECT v.done_on, v.scope_type, v.scope_value, v.action_type, v.description, v.commit_sha
FROM (VALUES
  ('2026-06-02'::date, 'url', 'leyes/*', 'ssr', 'SSR del temario (títulos) en /leyes/[law]: HTML crawleable + cacheable (tag teoria)', 'f918a514'),
  ('2026-06-02'::date, 'global', NULL, 'h1', 'Añadido <h1> SSR en páginas de ley (antes 0 H1; jerarquía empezaba en h3)', '640ce508'),
  ('2026-06-02'::date, 'global', NULL, 'title', 'Sigla/acrónimo (EBEP, LOPD, LPAC, LRJSP...) al frente del <title> y og:title', '640ce508'),
  ('2026-06-02'::date, 'url', 'leyes/*', 'ssr', 'Fallback del temario SSR a índice de artículos en leyes sin law_sections (LPRL, Ley 9/2017, Ley 55/2003)', '640ce508'),
  ('2026-06-02'::date, 'global', NULL, 'infra', 'Invalidación CloudFront automática en deploy + manual (las páginas ISR tardaban hasta 24h)', 'dde8efba')
) AS v(done_on, scope_type, scope_value, action_type, description, commit_sha)
WHERE NOT EXISTS (SELECT 1 FROM public.seo_actions WHERE done_on = '2026-06-02'::date);
