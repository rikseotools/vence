-- Analizador de Competidores — 2º competidor: OpositaTest (plataforma online)
--
-- Fuente targeted: sitemap.cursos.xml (44 productos = cursos por oposición,
-- server-rendered). Precio = suscripción global dinámica (Cloudflare/JS) → se
-- captará por headless-fetcher; el adapter deja prices vacío (no se inventa).
-- Diseño: docs/roadmap/analizador-competidores.md

INSERT INTO public.competitors (slug, name, base_url, tipo, region)
VALUES (
  'opositatest',
  'OpositaTest',
  'https://www.opositatest.com',
  'plataforma_online',
  'España'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT id, 'sitemap', 'https://www.opositatest.com/sitemap.cursos.xml'
FROM public.competitors WHERE slug = 'opositatest'
ON CONFLICT (competitor_id, url) DO NOTHING;
