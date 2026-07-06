-- Analizador de Competidores — 4º y 5º competidores
--
-- Líder Opositor (academia Málaga): WordPress bajo /web/, sitemap_index Yoast;
--   oposiciones jerárquicas server-rendered (≥2 segmentos bajo /oposiciones/ =
--   hoja). Sin precios públicos.
-- OpoMaster (plataforma): catálogo servido por Firebase/JS → no scrapeable con
--   fetch plano; se registra y se vigila el sitemap estático, cursos por headless.
-- Diseño: docs/roadmap/analizador-competidores.md

-- Líder Opositor -------------------------------------------------------------
INSERT INTO public.competitors (slug, name, base_url, tipo, region)
VALUES ('lideropositor', 'Líder Opositor', 'https://lideropositor.com/web/', 'academia_presencial', 'Málaga')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT id, 'sitemap_index', 'https://lideropositor.com/web/sitemap_index.xml'
FROM public.competitors WHERE slug = 'lideropositor'
ON CONFLICT (competitor_id, url) DO NOTHING;

-- OpoMaster ------------------------------------------------------------------
INSERT INTO public.competitors (slug, name, base_url, tipo, region, notes)
VALUES ('opomaster', 'OpoMaster', 'https://opomaster.com', 'plataforma_online', 'España',
        'Catálogo/precios por Firebase/JS → requieren headless-fetcher')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT id, 'sitemap', 'https://opomaster.com/sitemap.xml'
FROM public.competitors WHERE slug = 'opomaster'
ON CONFLICT (competitor_id, url) DO NOTHING;
