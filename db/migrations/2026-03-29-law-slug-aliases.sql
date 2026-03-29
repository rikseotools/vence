-- Migración: Tabla de aliases de slugs de leyes
-- Permite que URLs legacy y alias comunes redirijan al slug canónico.
-- SEO-friendly: middleware hace 301 redirect permanente.
-- Escalable: añadir alias = solo INSERT, sin tocar código.
-- Creado: 2026-03-29

CREATE TABLE IF NOT EXISTS law_slug_aliases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alias TEXT NOT NULL,
  canonical_slug TEXT NOT NULL,
  reason TEXT DEFAULT 'legacy',  -- 'legacy' | 'encoding_roto' | 'acronimo' | 'nombre_comun'
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Cada alias debe ser único
  CONSTRAINT law_slug_aliases_alias_unique UNIQUE (alias)
);

-- Índice para lookup rápido del middleware
CREATE INDEX IF NOT EXISTS law_slug_aliases_alias_idx ON law_slug_aliases (alias);

-- RLS: lectura pública (el middleware necesita leer sin auth)
ALTER TABLE law_slug_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Aliases legibles por todos" ON law_slug_aliases FOR SELECT USING (true);

-- ============================================
-- DATOS INICIALES: 69 aliases del diccionario estático eliminado
-- ============================================

INSERT INTO law_slug_aliases (alias, canonical_slug, reason) VALUES
  -- Acrónimos comunes
  ('ce', 'constitucion-espanola', 'acronimo'),
  ('cp', 'codigo-penal', 'acronimo'),
  ('lpac', 'ley-39-2015', 'acronimo'),
  ('lrjsp', 'ley-40-2015', 'acronimo'),
  ('trebep', 'rdl-5-2015', 'acronimo'),
  ('ebep', 'rdl-5-2015', 'acronimo'),
  ('lopj', 'lo-6-1985', 'acronimo'),
  ('lofcs', 'lo-2-1986', 'acronimo'),
  ('lopd', 'lo-3-2018', 'acronimo'),
  ('lopdgdd', 'lo-3-2018', 'acronimo'),
  ('loreg', 'lo-5-1985', 'acronimo'),
  ('logp', 'lo-1-1979', 'acronimo'),
  ('lomloe', 'lo-3-2020', 'acronimo'),
  ('rgpd', 'reglamento-ue-2016-679', 'acronimo'),
  ('lec', 'ley-1-2000', 'acronimo'),
  ('lecrim', 'rd-14-sep-1882', 'acronimo'),
  ('lsp', 'ley-5-2014', 'acronimo'),
  ('lcsp', 'ley-9-2017', 'acronimo'),
  ('ccom', 'codigo-comercio', 'acronimo'),
  ('loex', 'lo-4-2000', 'acronimo'),
  ('eomf', 'ley-50-1981', 'acronimo'),
  ('lotc', 'lo-2-1979', 'acronimo'),
  ('rcd', 'reglamento-del-congreso', 'acronimo'),
  ('rs', 'reglamento-del-senado', 'acronimo'),
  -- Nombres comunes / descriptivos
  ('transparencia', 'ley-19-2013', 'nombre_comun'),
  ('transparencia-buen-gobierno', 'ley-19-2013', 'nombre_comun'),
  ('procedimiento-administrativo', 'ley-39-2015', 'nombre_comun'),
  ('regimen-juridico', 'ley-40-2015', 'nombre_comun'),
  ('regimen-local', 'ley-7-1985', 'nombre_comun'),
  ('dependencia', 'ley-39-2006', 'nombre_comun'),
  ('seguridad-ciudadana', 'lo-4-2015', 'nombre_comun'),
  ('poder-judicial', 'lo-6-1985', 'nombre_comun'),
  ('ley-poder-judicial', 'lo-6-1985', 'nombre_comun'),
  ('ley-organica-poder-judicial', 'lo-6-1985', 'nombre_comun'),
  ('ley-organica-tribunal-constitucional', 'lotc', 'nombre_comun'),
  ('ley-proteccion-datos', 'lo-3-2018', 'nombre_comun'),
  ('ley-enjuiciamiento-criminal', 'rd-14-sep-1882', 'nombre_comun'),
  ('ministerio-fiscal', 'ley-50-1981', 'nombre_comun'),
  ('estatuto-ministerio-fiscal', 'ley-50-1981', 'nombre_comun'),
  ('defensor-pueblo', 'lo-3-1981', 'nombre_comun'),
  ('habeas-corpus', 'lo-6-1984', 'nombre_comun'),
  ('tribunal-jurado', 'lo-5-1995', 'nombre_comun'),
  ('extranjeria', 'lo-4-2000', 'nombre_comun'),
  ('proteccion-civil', 'lsnpc', 'nombre_comun'),
  ('ley-fuerzas-cuerpos-seguridad', 'lo-2-1986', 'nombre_comun'),
  ('trafico-seguridad-vial', 'ley-trafico', 'nombre_comun'),
  ('igualdad-trans-lgtbi', 'ley-4-2023', 'nombre_comun'),
  ('ley-organica-1-2004', 'lo-1-2004', 'nombre_comun'),
  ('ley-organica-3-2007', 'lo-3-2007', 'nombre_comun'),
  ('ley-organica-3-2018', 'lo-3-2018', 'nombre_comun'),
  -- Encoding roto (URLs indexadas en Google)
  ('constituci-n-espa-ola', 'constitucion-espanola', 'encoding_roto'),
  ('c-digo-civil', 'codigo-civil', 'encoding_roto'),
  ('correo-electr-nico', 'correo-electronico', 'encoding_roto'),
  ('inform-tica-b-sica', 'informatica-basica', 'encoding_roto'),
  ('hojas-de-c-lculo-excel', 'hojas-de-calculo-excel', 'encoding_roto'),
  ('ley-tr-fico', 'ley-trafico', 'encoding_roto'),
  ('ri-comisi-n', 'ri-comision', 'encoding_roto'),
  ('instrucci-n-2-2003-cgpj', 'instruccion-2-2003-cgpj', 'encoding_roto'),
  ('ley-funci-n-p-blica-andaluc-a-ley-5-2023', 'ley-funcion-publica-andalucia-ley-5-2023', 'encoding_roto'),
  ('resoluci-n-sefp-7-mayo-2024-intervalos-niveles', 'resolucion-sefp-7-mayo-2024-intervalos-niveles', 'encoding_roto'),
  ('administraci-n-electr-nica-y-servicios-al-ciudadano-csl', 'administracion-electronica-csl', 'encoding_roto'),
  ('reglamento-comisi-n-ue', 'reglamento-comision-ue', 'encoding_roto'),
  -- Variantes con acentos (URLs con caracteres UTF-8)
  ('código-civil', 'codigo-civil', 'legacy'),
  ('constitución-española', 'constitucion-espanola', 'legacy'),
  ('constitución-espanola', 'constitucion-espanola', 'legacy'),
  -- Alias de slug corto a slug descriptivo
  ('reglamento-congreso', 'reglamento-del-congreso', 'legacy'),
  ('reglamento-senado', 'reglamento-del-senado', 'legacy')
ON CONFLICT (alias) DO NOTHING;
