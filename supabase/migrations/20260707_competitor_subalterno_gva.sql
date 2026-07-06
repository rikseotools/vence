-- Analizador de Competidores — 7 competidores hallados vía "Subalterno GVA"
--
-- Búsqueda Google de la oposición Subalterno Generalitat Valenciana (gap con
-- runway: OEP 2026, 400 plazas, examen 28/11/2026) → academias que la preparan y
-- que no teníamos. 3 con adapter (generic-academy), 4 register-only con razón.
-- Idempotente. Runbook: docs/runbooks/analizador-competidores.md

INSERT INTO public.competitors (slug, name, base_url, tipo, region, notes) VALUES
  ('preparaopos',           'PrepáraOpos',            'https://www.preparaopos.es',           'plataforma_online',   'España',              NULL),
  ('betaformacion',         'Beta Formación',         'https://betaformacion.com',            'hibrida',             'Valencia (Torrent)',  NULL),
  ('codex',                 'Codex Oposiciones',      'https://www.codex.es',                 'academia_presencial', 'Valencia',            NULL),
  ('temariooposicionespdf', 'Temario Oposiciones PDF','https://www.temariooposicionespdf.es', 'plataforma_online',   'España',              'register-only: WooCommerce editorial ~2.000 productos → adapter pendiente hasta fix perf batch-inserts'),
  ('tutemario',             'TuTemario',              'https://tutemario.es',                 'plataforma_online',   'España',              'register-only: WooCommerce editorial ~1.600 productos → adapter pendiente hasta fix perf batch-inserts'),
  ('academiaalyma',         'Academia Alyma',         'https://www.academiaalyma.com',        'academia_presencial', 'Castellón',           'register-only: CodeIgniter sin sitemap de catálogo (~3 cursos), no rentable'),
  ('ugtserveispublicspv',   'UGT Serveis Públics PV', 'https://ugtserveispublicspv.org',      'plataforma_online',   'Comunitat Valenciana','register-only: portal de noticias sindical (cursos vía Academia Orion), sin catálogo de oposiciones')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT c.id, s.stype, s.url
FROM (VALUES
  ('preparaopos',           'sitemap_index', 'https://www.preparaopos.es/sitemap-index.xml'),
  ('betaformacion',         'sitemap_index', 'https://betaformacion.com/sitemap_index.xml'),
  ('codex',                 'sitemap',       'https://www.codex.es/sitemap.xml'),
  ('temariooposicionespdf', 'sitemap_index', 'https://www.temariooposicionespdf.es/sitemap_index.xml'),
  ('tutemario',             'sitemap_index', 'https://tutemario.es/sitemap_index.xml')
) AS s(slug, stype, url)
JOIN public.competitors c ON c.slug = s.slug
ON CONFLICT (competitor_id, url) DO NOTHING;
