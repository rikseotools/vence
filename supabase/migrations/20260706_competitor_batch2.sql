-- Analizador de Competidores — lote de 8 competidores nuevos
--
-- 7 con adapter server-rendered (temariosehs, oposicionesflou, superaoposiciones,
-- mad, opositas, adams, gokoan) + canaloposiciones register-only (agregador ASP.NET
-- sin sitemap → encaja mejor en el radar; no se scrapea como curso por ahora).
-- Diseño: docs/roadmap/analizador-competidores.md

-- price_kind 'curso' (curso completo a precio único, p.ej. adams JSON-LD) -------
ALTER TABLE public.competitor_prices DROP CONSTRAINT IF EXISTS competitor_prices_kind_check;
ALTER TABLE public.competitor_prices ADD CONSTRAINT competitor_prices_kind_check
  CHECK (price_kind = ANY (ARRAY['matricula','cuota','intensivo','tasa','material','curso','otro']));

-- Competidores ---------------------------------------------------------------
INSERT INTO public.competitors (slug, name, base_url, tipo, region, notes) VALUES
  ('temariosehs', 'Temarios EHS', 'https://temariosehs.com', 'hibrida', 'Andalucía (Córdoba)', NULL),
  ('oposicionesflou', 'Oposiciones FLOU', 'https://oposicionesflou.com', 'hibrida', 'España', 'Foco docentes/educación'),
  ('superaoposiciones', 'Supera Oposiciones', 'https://www.superaoposiciones.es', 'hibrida', 'España', 'Framer; sin precio (lead-gen)'),
  ('mad', 'Editorial MAD', 'https://mad.es', 'plataforma_online', 'España', 'Editorial (PrestaShop); precio por libro'),
  ('opositas', 'Opositas', 'https://www.opositas.com', 'plataforma_online', 'España', NULL),
  ('adams', 'ADAMS', 'https://www.adams.es', 'hibrida', 'España', 'Precio por curso en JSON-LD'),
  ('gokoan', 'GoKoan', 'https://www.gokoan.com', 'plataforma_online', 'España', 'Suscripción; planes en HTML'),
  ('canaloposiciones', 'Canal Oposiciones', 'https://www.canaloposiciones.com', NULL, 'España',
   'Agregador/directorio ASP.NET sin sitemap → encaja mejor en el radar; sin adapter de cursos por ahora')
ON CONFLICT (slug) DO NOTHING;

-- Fuentes (sitemaps). canaloposiciones NO tiene fuente (register-only). --------
INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT c.id, s.stype, s.url
FROM (VALUES
  ('temariosehs',       'sitemap_index', 'https://temariosehs.com/sitemap_index.xml'),
  ('oposicionesflou',   'sitemap',       'https://oposicionesflou.com/oposicion-sitemap.xml'),
  ('superaoposiciones', 'sitemap',       'https://www.superaoposiciones.es/sitemap.xml'),
  ('mad',               'sitemap',       'https://mad.es/1_es_0_sitemap.xml'),
  ('opositas',          'sitemap',       'https://www.opositas.com/oposiciones-sitemap.xml'),
  ('gokoan',            'sitemap',       'https://www.gokoan.com/sitemap.xml'),
  ('adams',             'sitemap',       'https://www.adams.es/sitemap/products/1.xml'),
  ('adams',             'sitemap',       'https://www.adams.es/sitemap/products/2.xml'),
  ('adams',             'sitemap',       'https://www.adams.es/sitemap/products/3.xml'),
  ('adams',             'sitemap',       'https://www.adams.es/sitemap/products/4.xml'),
  ('adams',             'sitemap',       'https://www.adams.es/sitemap/products/5.xml')
) AS s(slug, stype, url)
JOIN public.competitors c ON c.slug = s.slug
ON CONFLICT (competitor_id, url) DO NOTHING;
