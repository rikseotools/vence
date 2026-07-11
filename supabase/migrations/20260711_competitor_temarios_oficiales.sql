-- Analizador de Competidores — Temarios Oficiales (sondeado 11/07/2026)
--
--  · temarios-oficiales — editorial: temarios en PDF por oposición (WordPress +
--    WooCommerce). Fuente sitemap_index (/sitemap_index.xml Yoast → hijos
--    product-sitemap{,2,3}.xml). Hojas /product/<slug>/; precio en JSON-LD
--    Product (WooCommerce `offers.price`; producto variable → "desde"). Vende,
--    entre otros, TAI del Estado (95–260€).
--
-- El competidor ya existía (alta register-only 11/07). Esta migración lo hace
-- reproducible y CAMBIA su fuente de listing_html (base_url, no accionable sin
-- adapter) a la fuente sitemap real que consume el nuevo adapter.
-- Diseño: docs/roadmap/analizador-competidores.md · adapter en backend/.../adapters/temariosoficiales.ts

-- Competidor (idempotente; ya insertado register-only) -----------------------
INSERT INTO public.competitors (slug, name, base_url, tipo, region, notes) VALUES
  ('temarios-oficiales', 'Temarios Oficiales', 'https://temariosoficiales.com', 'plataforma_online', 'España',
   'Editorial (WordPress/WooCommerce); temario PDF a precio único por oposición. JSON-LD Product (offers.price)')
ON CONFLICT (slug) DO NOTHING;

-- Fuente sitemap real (sustituye a la register-only listing_html) -------------
INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT id, 'sitemap_index', 'https://temariosoficiales.com/sitemap_index.xml'
FROM public.competitors WHERE slug = 'temarios-oficiales'
ON CONFLICT (competitor_id, url) DO NOTHING;

-- Retirar la fuente register-only (base_url) — el sitemap la reemplaza.
UPDATE public.competitor_sources s
SET is_active = false
FROM public.competitors c
WHERE s.competitor_id = c.id
  AND c.slug = 'temarios-oficiales'
  AND s.source_type = 'listing_html';
