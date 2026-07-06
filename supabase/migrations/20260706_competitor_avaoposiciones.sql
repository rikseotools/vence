-- Analizador de Competidores — 3er competidor: AvA Oposiciones (academia Córdoba)
--
-- WordPress sin WAF. Fuente: wp-sitemap-posts-course-1.xml (3 cursos, /course/<slug>).
-- Nombre desde el slug (h1 genérico). Sin precios públicos → prices vacío.
-- Diseño: docs/roadmap/analizador-competidores.md

INSERT INTO public.competitors (slug, name, base_url, tipo, region)
VALUES (
  'avaoposiciones',
  'AvA Oposiciones',
  'https://avaoposiciones.net',
  'academia_presencial',
  'Córdoba'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT id, 'sitemap', 'https://avaoposiciones.net/wp-sitemap-posts-course-1.xml'
FROM public.competitors WHERE slug = 'avaoposiciones'
ON CONFLICT (competitor_id, url) DO NOTHING;
