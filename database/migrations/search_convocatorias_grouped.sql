-- Función para buscar convocatorias agrupadas con sus publicaciones relacionadas
-- Las convocatorias aparecen como "padres" y admitidos/tribunal/resultados como "hijos"
-- Las publicaciones sin vínculo aparecen como items sueltos

CREATE OR REPLACE FUNCTION search_convocatorias_grouped(
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
  -- Datos de la convocatoria/publicación
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
  -- Publicaciones relacionadas como JSON array (solo para padres)
  publicaciones_relacionadas JSONB,
  total_relacionadas INT,
  -- Flag para saber si es un item "suelto" (sin padre conocido)
  es_standalone BOOLEAN,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  search_normalized TEXT;
  v_total BIGINT;
BEGIN
  -- Normalizar término de búsqueda
  search_normalized := unaccent(lower(COALESCE(search_term, '')));

  -- Contar total: solo convocatorias principales
  SELECT COUNT(*) INTO v_total
  FROM convocatorias_boe c
  WHERE c.is_active = true
    AND c.tipo = 'convocatoria'  -- Solo convocatorias
    AND (search_term IS NULL OR search_term = '' OR
         unaccent(lower(c.titulo)) ILIKE '%' || search_normalized || '%' OR
         unaccent(lower(COALESCE(c.resumen, ''))) ILIKE '%' || search_normalized || '%' OR
         unaccent(lower(COALESCE(c.departamento_nombre, ''))) ILIKE '%' || search_normalized || '%' OR
         unaccent(lower(COALESCE(c.cuerpo, ''))) ILIKE '%' || search_normalized || '%')
    AND (p_categoria IS NULL OR c.categoria = p_categoria)
    -- p_tipo ignorado - siempre filtramos por tipo='convocatoria'
    AND (p_ambito IS NULL OR c.ambito = p_ambito)
    AND (p_ccaa IS NULL OR c.comunidad_autonoma = p_ccaa)
    AND (p_provincia IS NULL OR unaccent(lower(COALESCE(c.provincia, ''))) ILIKE unaccent(lower(p_provincia)));

  RETURN QUERY
  WITH items_principales AS (
    -- Solo convocatorias principales
    SELECT
      c.*,
      false as is_standalone  -- Ya no hay standalone, solo convocatorias
    FROM convocatorias_boe c
    WHERE c.is_active = true
      AND c.tipo = 'convocatoria'  -- Solo convocatorias
      AND (search_term IS NULL OR search_term = '' OR
           unaccent(lower(c.titulo)) ILIKE '%' || search_normalized || '%' OR
           unaccent(lower(COALESCE(c.resumen, ''))) ILIKE '%' || search_normalized || '%' OR
           unaccent(lower(COALESCE(c.departamento_nombre, ''))) ILIKE '%' || search_normalized || '%' OR
           unaccent(lower(COALESCE(c.cuerpo, ''))) ILIKE '%' || search_normalized || '%')
      AND (p_categoria IS NULL OR c.categoria = p_categoria)
      -- p_tipo ignorado - ya filtramos por tipo='convocatoria' arriba
      AND (p_ambito IS NULL OR c.ambito = p_ambito)
      AND (p_ccaa IS NULL OR c.comunidad_autonoma = p_ccaa)
      AND (p_provincia IS NULL OR unaccent(lower(COALESCE(c.provincia, ''))) ILIKE unaccent(lower(p_provincia)))
    ORDER BY
      CASE WHEN p_orden = 'antiguos' THEN c.boe_fecha END ASC,
      CASE WHEN p_orden = 'plazas' THEN COALESCE(c.num_plazas, 0) END DESC,
      CASE WHEN p_orden = 'recientes' OR p_orden IS NULL THEN c.boe_fecha END DESC,
      c.relevancia_score DESC
    LIMIT p_limit
    OFFSET p_offset
  ),
  relacionadas AS (
    -- Publicaciones hijas agrupadas por su padre
    SELECT
      r.convocatoria_origen_id,
      jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'boe_id', r.boe_id,
          'boe_fecha', r.boe_fecha,
          'boe_url_html', r.boe_url_html,
          'titulo_limpio', r.titulo_limpio,
          'tipo', r.tipo,
          'resumen', r.resumen
        ) ORDER BY r.boe_fecha DESC
      ) as publicaciones,
      COUNT(*)::INT as total_rel
    FROM convocatorias_boe r
    WHERE r.is_active = true
      AND r.convocatoria_origen_id IN (SELECT ip.id FROM items_principales ip)
    GROUP BY r.convocatoria_origen_id
  )
  SELECT
    ip.id,
    ip.boe_id,
    ip.boe_fecha,
    ip.boe_url_pdf,
    ip.boe_url_html,
    ip.titulo,
    ip.titulo_limpio,
    ip.departamento_nombre,
    ip.epigrafe,
    ip.tipo,
    ip.categoria,
    ip.num_plazas,
    ip.num_plazas_libre,
    ip.num_plazas_pi,
    ip.oposicion_relacionada,
    ip.ambito,
    ip.comunidad_autonoma,
    ip.provincia,
    ip.municipio,
    ip.resumen,
    ip.acceso,
    ip.fecha_limite_inscripcion,
    COALESCE(rel.publicaciones, '[]'::jsonb) as publicaciones_relacionadas,
    COALESCE(rel.total_rel, 0) as total_relacionadas,
    ip.is_standalone as es_standalone,
    v_total as total_count
  FROM items_principales ip
  LEFT JOIN relacionadas rel ON rel.convocatoria_origen_id = ip.id
  ORDER BY
    CASE WHEN p_orden = 'antiguos' THEN ip.boe_fecha END ASC,
    CASE WHEN p_orden = 'plazas' THEN COALESCE(ip.num_plazas, 0) END DESC,
    CASE WHEN p_orden = 'recientes' OR p_orden IS NULL THEN ip.boe_fecha END DESC,
    ip.relevancia_score DESC;
END;
$$;

-- Grant permisos
GRANT EXECUTE ON FUNCTION search_convocatorias_grouped TO anon, authenticated;

-- Comentario
COMMENT ON FUNCTION search_convocatorias_grouped IS 'Busca convocatorias con publicaciones relacionadas agrupadas. Items sin vínculo aparecen sueltos.';
