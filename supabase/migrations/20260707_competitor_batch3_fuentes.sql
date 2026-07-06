-- Analizador de Competidores — fuentes afinadas de los 11 adapters del lote 3
--
-- El batch3 registró estos competidores con su sitemap-index. El recon 07/07
-- localizó el sitemap-HIJO concreto que lista las oposiciones/cursos → se añade
-- como fuente directa (más eficiente y robusto que depender del index). Idempotente.
-- Los demás competidores del batch3 quedan register-only (sin adapter).

INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT c.id, 'sitemap', s.url
FROM (VALUES
  ('aulaplusformacion',      'https://aulaplusformacion.es/product-sitemap.xml'),
  ('masterd',                'https://www.oposicionesmasterd.es/sitemap'),
  ('innovaticos',            'https://www.innovaticos.com/oposiciones-sitemap1.xml'),
  ('academiatrivium',        'https://www.academiatrivium.com/us_portfolio-sitemap.xml'),
  ('academianota',           'https://academianota.com/page-sitemap.xml'),
  ('pacocanete',             'https://pacocanete.com/page-sitemap.xml'),
  ('feslformacion',          'https://www.feslformacion.com/page-sitemap.xml'),
  ('atrioposicioneshacienda','https://www.atrioposicioneshacienda.es/page-sitemap.xml'),
  ('administraciondejusticia','https://www.administraciondejusticia.com/product-sitemap.xml'),
  ('formaopositores',        'https://formaopositores.com/project-sitemap.xml'),
  ('cetoposiciones',         'https://www.cetoposiciones.com/pages-sitemap.xml')
) AS s(slug, url)
JOIN public.competitors c ON c.slug = s.slug
ON CONFLICT (competitor_id, url) DO NOTHING;
