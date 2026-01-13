-- Función para buscar convocatorias ignorando acentos
-- Requiere la extensión unaccent (ya está habilitada en Supabase por defecto)

CREATE OR REPLACE FUNCTION search_convocatorias(
  search_term TEXT,
  p_categoria TEXT DEFAULT NULL,
  p_tipo TEXT DEFAULT NULL,
  p_ambito TEXT DEFAULT NULL,
  p_ccaa TEXT DEFAULT NULL,
  p_provincia TEXT DEFAULT NULL,
  p_orden TEXT DEFAULT 'recientes',
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  boe_id TEXT,
  boe_fecha DATE,
  boe_url_pdf TEXT,
  boe_url_html TEXT,
  titulo TEXT,
  titulo_limpio TEXT,
  departamento_nombre TEXT,
  epigrafe TEXT,
  tipo TEXT,
  categoria TEXT,
  num_plazas INT,
  num_plazas_libre INT,
  num_plazas_pi INT,
  oposicion_relacionada TEXT,
  ambito TEXT,
  comunidad_autonoma TEXT,
  provincia TEXT,
  municipio TEXT,
  resumen TEXT,
  acceso TEXT,
  fecha_limite_inscripcion DATE,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  search_normalized TEXT;
  total BIGINT;
BEGIN
  -- Normalizar término de búsqueda
  search_normalized := unaccent(lower(search_term));

  -- Contar total
  SELECT COUNT(*) INTO total
  FROM convocatorias_boe c
  WHERE c.is_active = true
    AND (search_term IS NULL OR search_term = '' OR
         unaccent(lower(c.titulo)) ILIKE '%' || search_normalized || '%' OR
         unaccent(lower(c.resumen)) ILIKE '%' || search_normalized || '%' OR
         unaccent(lower(c.departamento_nombre)) ILIKE '%' || search_normalized || '%' OR
         unaccent(lower(c.cuerpo)) ILIKE '%' || search_normalized || '%')
    AND (p_categoria IS NULL OR c.categoria = p_categoria)
    AND (p_tipo IS NULL OR c.tipo = p_tipo)
    AND (p_ambito IS NULL OR c.ambito = p_ambito)
    AND (p_ccaa IS NULL OR c.comunidad_autonoma = p_ccaa)
    AND (p_provincia IS NULL OR unaccent(lower(c.provincia)) ILIKE unaccent(lower(p_provincia)));

  RETURN QUERY
  SELECT
    c.id,
    c.boe_id,
    c.boe_fecha,
    c.boe_url_pdf,
    c.boe_url_html,
    c.titulo,
    c.titulo_limpio,
    c.departamento_nombre,
    c.epigrafe,
    c.tipo,
    c.categoria,
    c.num_plazas,
    c.num_plazas_libre,
    c.num_plazas_pi,
    c.oposicion_relacionada,
    c.ambito,
    c.comunidad_autonoma,
    c.provincia,
    c.municipio,
    c.resumen,
    c.acceso,
    c.fecha_limite_inscripcion,
    total
  FROM convocatorias_boe c
  WHERE c.is_active = true
    AND (search_term IS NULL OR search_term = '' OR
         unaccent(lower(c.titulo)) ILIKE '%' || search_normalized || '%' OR
         unaccent(lower(c.resumen)) ILIKE '%' || search_normalized || '%' OR
         unaccent(lower(c.departamento_nombre)) ILIKE '%' || search_normalized || '%' OR
         unaccent(lower(c.cuerpo)) ILIKE '%' || search_normalized || '%')
    AND (p_categoria IS NULL OR c.categoria = p_categoria)
    AND (p_tipo IS NULL OR c.tipo = p_tipo)
    AND (p_ambito IS NULL OR c.ambito = p_ambito)
    AND (p_ccaa IS NULL OR c.comunidad_autonoma = p_ccaa)
    AND (p_provincia IS NULL OR unaccent(lower(c.provincia)) ILIKE unaccent(lower(p_provincia)))
  ORDER BY
    CASE WHEN p_orden = 'antiguos' THEN c.boe_fecha END ASC,
    CASE WHEN p_orden = 'plazas' THEN COALESCE(c.num_plazas, 0) END DESC,
    CASE WHEN p_orden = 'recientes' OR p_orden IS NULL THEN c.boe_fecha END DESC,
    c.relevancia_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant permisos
GRANT EXECUTE ON FUNCTION search_convocatorias TO anon, authenticated;
