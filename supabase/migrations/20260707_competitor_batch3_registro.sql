-- Analizador de Competidores — lote 3 (registro masivo)
--
-- Registra ~25 competidores nuevos (mayoría academias, muchas de Murcia) con su
-- base_url + fuente sitemap detectada en recon. IDEMPOTENTE (ON CONFLICT DO
-- NOTHING) → no choca con lo que añade en paralelo otra sesión.
-- Los ADAPTERS de extracción de cursos (classifyUrl/parseCourse por competidor)
-- son follow-up: estructuras heterogéneas (Woo product-sitemap vs oposiciones-
-- como-posts). Sin adapter, el sync no los procesa aún (fila catalogada, inerte).
-- Runbook: docs/runbooks/analizador-competidores.md

INSERT INTO public.competitors (slug, name, base_url, tipo, region, notes) VALUES
  ('gmoposiciones',        'GM Oposiciones',            'https://gmoposiciones.es',                 'academia_presencial', 'Murcia',  'WooCommerce; CARM/Murcia'),
  ('formaopositores',      'Forma Opositores',          'https://formaopositores.com',              'academia_presencial', 'España',  NULL),
  ('administraciondejusticia','Academia Administración de Justicia','https://www.administraciondejusticia.com','academia_presencial','España','WooCommerce; foco Justicia/Estado'),
  ('age360academia',       'AGE360 (Forvide)',          'https://www.academiaforvide.es',           'academia_presencial', 'España',  'age360academia.es redirige a academiaforvide.es'),
  ('cetoposiciones',       'CET Oposiciones',           'https://www.cetoposiciones.com',           'academia_presencial', 'España',  NULL),
  ('innovaticos',          'Innovaticos',               'https://www.innovaticos.com',              'plataforma_online',   'España',  'Foco TIC/informática'),
  ('academiatrivium',      'Academia Trivium',          'https://www.academiatrivium.com',          'academia_presencial', 'España',  NULL),
  ('academianota',         'Academia Nota',             'https://academianota.com',                 'academia_presencial', 'España',  NULL),
  ('aprendeoposiciones',   'Aprende Oposiciones',       'https://aprendeoposiciones.com',           'plataforma_online',   'España',  NULL),
  ('aulaplusformacion',    'Aula Plus Formación',       'https://aulaplusformacion.es',             'academia_presencial', 'España',  'WooCommerce'),
  ('pacocanete',           'Academia Paco Cañete',      'https://pacocanete.com',                   'academia_presencial', 'España',  NULL),
  ('oposicionesestadistica','Oposiciones Estadística',  'https://oposicionesestadistica.es',        'plataforma_online',   'España',  'Foco cuerpos de estadística (INE)'),
  ('academialascortes',    'Academia Las Cortes',       'https://academialascortes.com',            'academia_presencial', 'España',  NULL),
  ('masterd',              'MasterD Oposiciones',       'https://www.oposicionesmasterd.es',        'hibrida',             'España',  'Gran academia nacional; sitemap en /sitemap'),
  ('fernandomiro',         'Academia Fernando Miró',    'https://www.fernandomiro.com',             'academia_presencial', 'España',  NULL),
  ('academiaalbatros',     'Academia Albatros',         'https://academiaalbatros.es',              'academia_presencial', 'España',  'Sin sitemap detectado → register-only'),
  ('oposicionesdocencia',  'Oposiciones Docencia',      'https://oposicionesdocencia.es',           'academia_presencial', 'España',  'Foco docentes/educación'),
  ('academiafinap',        'Academia FINAP',            'https://academiafinap.com',                'academia_presencial', 'Murcia',  'Sitemap vía CDN Attracta'),
  ('oposicionesmurcia',    'Oposiciones Murcia',        'https://oposicionesmurcia.com',            'academia_presencial', 'Murcia',  NULL),
  ('feslformacion',        'FESL Formación',            'https://www.feslformacion.com',            'academia_presencial', 'España',  NULL),
  ('atrioposicioneshacienda','Atrio Oposiciones Hacienda','https://www.atrioposicioneshacienda.es', 'academia_presencial', 'España',  'WooCommerce; foco Hacienda'),
  ('academiaprefortia',    'Academia Prefortia',        'https://www.academiaprefortia.com',        'academia_presencial', 'España',  NULL),
  ('aprendoyo',            'Aprendoyo',                 'https://www.aprendoyo.com',                'plataforma_online',   'España',  NULL),
  ('murciaoposiciones',    'Murcia Oposiciones',        'https://www.murciaoposiciones.com',        'academia_presencial', 'Murcia',  NULL),
  ('academiamurcia',       'Academia Murcia',           'https://academia-murcia.es',               'academia_presencial', 'Murcia',  NULL),
  ('reverte',              'Academia José Luis Reverte','https://laacademiadejoseluisreverte.es',   'academia_presencial', 'España',  NULL),
  ('centroestudiosmurcia', 'Centro de Estudios Murcia', 'https://www.centrodestudiosmurcia.com',    'academia_presencial', 'Murcia',  NULL)
ON CONFLICT (slug) DO NOTHING;

-- Fuentes sitemap detectadas (los sin sitemap fiable no llevan fuente). ---------
INSERT INTO public.competitor_sources (competitor_id, source_type, url)
SELECT c.id, s.stype, s.url
FROM (VALUES
  ('gmoposiciones',        'sitemap_index', 'https://gmoposiciones.es/sitemap_index.xml'),
  ('formaopositores',      'sitemap',       'https://formaopositores.com/sitemap.xml'),
  ('administraciondejusticia','sitemap_index','https://www.administraciondejusticia.com/sitemap_index.xml'),
  ('age360academia',       'sitemap',       'https://www.academiaforvide.es/sitemap.xml'),
  ('cetoposiciones',       'sitemap',       'https://www.cetoposiciones.com/sitemap.xml'),
  ('innovaticos',          'sitemap',       'https://www.innovaticos.com/sitemaps.xml'),
  ('academianota',         'sitemap_index', 'https://academianota.com/sitemap_index.xml'),
  ('aprendeoposiciones',   'sitemap',       'https://aprendeoposiciones.com/sitemap.xml'),
  ('aulaplusformacion',    'sitemap_index', 'https://aulaplusformacion.es/sitemap_index.xml'),
  ('pacocanete',           'sitemap_index', 'https://pacocanete.com/sitemap_index.xml'),
  ('oposicionesestadistica','sitemap_index','https://oposicionesestadistica.es/sitemap_index.xml'),
  ('academialascortes',    'sitemap_index', 'https://academialascortes.com/sitemap_index.xml'),
  ('masterd',              'sitemap_index', 'https://www.oposicionesmasterd.es/sitemap'),
  ('fernandomiro',         'sitemap_index', 'https://www.fernandomiro.com/sitemap_index.xml'),
  ('oposicionesdocencia',  'sitemap_index', 'https://oposicionesdocencia.es/sitemap_index.xml'),
  ('oposicionesmurcia',    'sitemap_index', 'https://oposicionesmurcia.com/wp-sitemap.xml'),
  ('feslformacion',        'sitemap_index', 'https://www.feslformacion.com/sitemap_index.xml'),
  ('atrioposicioneshacienda','sitemap_index','https://www.atrioposicioneshacienda.es/sitemap_index.xml'),
  ('academiaprefortia',    'sitemap',       'https://www.academiaprefortia.com/sitemap.xml'),
  ('aprendoyo',            'sitemap_index', 'https://www.aprendoyo.com/wp-sitemap.xml'),
  ('murciaoposiciones',    'sitemap_index', 'https://www.murciaoposiciones.com/wp-sitemap.xml'),
  ('academiamurcia',       'sitemap_index', 'https://academia-murcia.es/sitemap_index.xml'),
  ('reverte',              'sitemap_index', 'https://laacademiadejoseluisreverte.es/sitemap_index.xml'),
  ('academiatrivium',      'sitemap_index', 'https://www.academiatrivium.com/sitemap_index.xml')
) AS s(slug, stype, url)
JOIN public.competitors c ON c.slug = s.slug
ON CONFLICT (competitor_id, url) DO NOTHING;
