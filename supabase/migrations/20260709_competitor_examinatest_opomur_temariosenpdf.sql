-- Analizador de Competidores — 3 competidores nuevos (sondeados 09/07/2026)
--
--  · examinatest    — plataforma de test online por suscripción (estatal + Murcia
--                     CARM/SMS). SIN sitemap → fuente listing_html = /oposiciones
--                     (discoverUrls extrae las 38 hojas). Cuota "Desde X €/mes".
--  · opomur         — plataforma de test (Murcia + estatal), WooCommerce Subscriptions.
--                     Listado por JS → fuente listing_html = WooCommerce Store API
--                     (JSON público). Cuota mensual (JSON-LD Offer en la hoja).
--  · temariosenpdf  — editorial: temarios en PDF (Shopify). Fuente sitemap_index
--                     (el hijo /sitemap_products_1.xml lleva ?from=&to= obligatoria,
--                     ya embebida en el índice). Precio único (JSON-LD AggregateOffer).
--
-- Diseño: docs/roadmap/analizador-competidores.md · adapters en backend/.../adapters/

-- Competidores ---------------------------------------------------------------
INSERT INTO public.competitors (slug, name, base_url, tipo, region, notes) VALUES
  ('examinatest',   'ExaminaTest',   'https://www.examinatest.es', 'plataforma_online', 'España',
   'Test por suscripción; sin sitemap → listing_html /oposiciones. Cuota "desde €/mes"'),
  ('opomur',        'Opomur',        'https://opomur.es',          'plataforma_online', 'Murcia',
   'WooCommerce Subscriptions; listado por JS → listing_html = WC Store API JSON'),
  ('temariosenpdf', 'TemariosenPDF', 'https://www.temariosenpdf.es','plataforma_online','España',
   'Editorial (Shopify); temario PDF a precio único. JSON-LD AggregateOffer (lowPrice)')
ON CONFLICT (slug) DO NOTHING;

-- Fuentes --------------------------------------------------------------------
INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT c.id, s.stype, s.url
FROM (VALUES
  ('examinatest',   'listing_html',  'https://www.examinatest.es/oposiciones'),
  ('opomur',        'listing_html',  'https://opomur.es/wp-json/wc/store/products?per_page=100'),
  ('temariosenpdf', 'sitemap_index', 'https://www.temariosenpdf.es/sitemap.xml')
) AS s(slug, stype, url)
JOIN public.competitors c ON c.slug = s.slug
ON CONFLICT (competitor_id, url) DO NOTHING;
