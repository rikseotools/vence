-- Analizador de Competidores — stack tecnológico
--
-- `tech` decide la ESTRATEGIA de scraping (no es solo organización):
--   rendering='js'   → usar el headless-fetcher (Lambda Playwright) en vez de fetch
--   cdn_waf='cloudflare' → esperar challenges/403, ir con cuidado
--   cms/sitemap_generator → predice si el sitemap es completo o hace falta listing_html
-- Se detecta GRATIS de lo que ya descargamos (meta generator + cabeceras).
-- Diseño: docs/roadmap/analizador-competidores.md

ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS tech jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.competitors.tech IS
  'Stack detectado (cms, sitemap_generator, server, cdn_waf, rendering, has_public_api, lms). Decide la estrategia de scraping: rendering=js → headless-fetcher.';
