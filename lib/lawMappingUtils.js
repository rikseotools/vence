// lib/lawMappingUtils.js - MAPEOS CENTRALIZADOS PARA TODAS LAS LEYES
// Esto evita duplicar el mapeo en diferentes archivos

// 🔧 FUNCIÓN PRINCIPAL: Mapear slug a short_name
export function mapLawSlugToShortName(lawSlug) {
  const mapping = {
    // Leyes principales
    'ley-19-2013': 'Ley 19/2013',
    'ley-40-2015': 'Ley 40/2015',
    'lrjsp': 'Ley 40/2015',
    'ley-39-2015': 'Ley 39/2015', 
    'lpac': 'Ley 39/2015',
    'ley-50-1997': 'Ley 50/1997',
    'ley-7-1985': 'Ley 7/1985',
    'ley-2-2014': 'Ley 2/2014',
    'ley-25-2014': 'Ley 25/2014',
    'ley-38-2015': 'Ley 38/2015',
    
    // Constitución y tratados
    'ce': 'CE',
    'constitucion-espanola': 'CE',
    'constitución-española': 'CE',
    'constitución-espanola': 'CE',
    'tue': 'TUE',
    'tfue': 'TFUE',
    
    // Códigos
    'codigo-civil': 'Código Civil',
    'código-civil': 'Código Civil',
    'codigo-penal': 'Código Penal',
    'código-penal': 'Código Penal',
    
    // Laborales
    'estatuto-trabajadores': 'Estatuto de los Trabajadores',
    'estatuto-de-los-trabajadores': 'Estatuto de los Trabajadores',
    
    // Real Decretos específicos
    'rd-364-1995': 'RD 364/1995',
    
    // 🆕 NUEVAS LEYES SEGÚN TU DOCUMENTACIÓN
    'gobierno-abierto': 'Gobierno Abierto',
    'agenda-2030': 'Agenda 2030',
    'orden-hfp-134-2018': 'Orden HFP/134/2018',
    
    // 🏛️ TEMA 4 - PODER JUDICIAL (NUEVOS)
    'lo-6-1985': 'LO 6/1985',
    'ley-organica-poder-judicial': 'LO 6/1985',
    'lopj': 'LO 6/1985',
    'poder-judicial': 'LO 6/1985',
    'lo-3-1981': 'LO 3/1981',
    'ley-50-1981': 'Ley 50/1981',
    'ministerio-fiscal': 'Ley 50/1981',
    'estatuto-ministerio-fiscal': 'Ley 50/1981',
    'eomf': 'Ley 50/1981',
    
    // Protocolos y reglamentos europeos
    'protocolo-1': 'Protocolo nº 1',
    'protocolo-2': 'Protocolo nº 2',
    'reglamento-ce-1049-2001': 'Reglamento (CE) nº 1049/2001',
    'reglamento-ue-2018-1046': 'Reglamento (UE, Euratom) 2018/1046',
    
    // Alias adicionales
    'transparencia': 'Ley 19/2013',
    'procedimiento-administrativo': 'LPAC',
    'regimen-juridico': 'LRJSP',
    'regimen-local': 'Ley 7/1985'
  }
  
  const result = mapping[lawSlug]
  
  if (!result) {
    console.warn(`⚠️ Slug no encontrado en mapeo: ${lawSlug}`)
    
    // 🆕 FALLBACK DINÁMICO: Intentar generar short_name desde slug
    const dynamicShortName = generateShortNameFromSlug(lawSlug)
    if (dynamicShortName) {
      console.log(`🔄 Generado dinámicamente: ${lawSlug} → ${dynamicShortName}`)
      return dynamicShortName
    }
    
    return lawSlug // Como última opción, devolver el slug original
  }
  
  return result
}

// 🆕 FUNCIÓN AUXILIAR: Generar short_name desde slug dinámicamente
function generateShortNameFromSlug(slug) {
  if (!slug) return null
  
  try {
    // Patrones comunes para generar automáticamente
    const patterns = [
      // Leyes Orgánicas: 'lo-3-1981' → 'LO 3/1981'
      {
        regex: /^lo-(\d+)-(\d+)$/,
        transform: (match) => `LO ${match[1]}/${match[2]}`
      },
      // Leyes normales: 'ley-15-2022' → 'Ley 15/2022'
      {
        regex: /^ley-(\d+)-(\d+)$/,
        transform: (match) => `Ley ${match[1]}/${match[2]}`
      },
      // Real Decreto: 'rd-123-2020' → 'RD 123/2020'
      {
        regex: /^rd-(\d+)-(\d+)$/,
        transform: (match) => `RD ${match[1]}/${match[2]}`
      },
      // Decreto: 'decreto-456-2019' → 'Decreto 456/2019'
      {
        regex: /^decreto-(\d+)-(\d+)$/,
        transform: (match) => `Decreto ${match[1]}/${match[2]}`
      }
    ]
    
    for (const pattern of patterns) {
      const match = slug.match(pattern.regex)
      if (match) {
        return pattern.transform(match)
      }
    }
    
    // Si no coincide con ningún patrón, convertir básicamente
    // 'codigo-civil' → 'Código Civil'
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      
  } catch (error) {
    console.error('Error generando short_name dinámico:', error)
    return null
  }
}

// 🎯 NUEVA FUNCIÓN: URLs CANONICALS (SEO-friendly)
export function getCanonicalSlug(shortName) {
  const canonicalMapping = {
    // Principales (orden alfabético para mantenimiento)
    'CE': 'constitucion-espanola',
    'Código Civil': 'codigo-civil',
    'Código Penal': 'codigo-penal',
    'Estatuto de los Trabajadores': 'estatuto-trabajadores',
    
    // Leyes administrativas
    'Ley 39/2015': 'ley-39-2015',
    'Ley 40/2015': 'ley-40-2015',
    'LRJSP': 'ley-40-2015', // LRJSP es alias de Ley 40/2015
    'Ley 19/2013': 'ley-19-2013',
    'Ley 7/1985': 'ley-7-1985',
    'Ley 50/1997': 'ley-50-1997',
    'Ley 2/2014': 'ley-2-2014',
    'Ley 25/2014': 'ley-25-2014',
    'Ley 38/2015': 'ley-38-2015',
    
    // Real Decretos
    'RD 364/1995': 'rd-364-1995',
    
    // 🏛️ PODER JUDICIAL - URLs SEO optimizadas
    'LO 6/1985': 'lo-6-1985',
    'LO 3/1981': 'lo-3-1981',
    'Ley 50/1981': 'ley-50-1981',
    
    // Europeas
    'TUE': 'tue',
    'TFUE': 'tfue',
    'Protocolo nº 1': 'protocolo-1',
    'Protocolo nº 2': 'protocolo-2',
    'Reglamento (CE) nº 1049/2001': 'reglamento-ce-1049-2001',
    'Reglamento (UE, Euratom) 2018/1046': 'reglamento-ue-2018-1046',
    
    // Especiales
    'Gobierno Abierto': 'gobierno-abierto',
    'Agenda 2030': 'agenda-2030',
    'Orden HFP/134/2018': 'orden-hfp-134-2018'
  }
  
  // Si tiene mapeo específico, usarlo. Si no, generar automático
  return canonicalMapping[shortName] || generateLawSlug(shortName)
}

// 🔧 FUNCIÓN: Obtener información completa de la ley
export function getLawInfo(lawSlug) {
  const lawShortName = mapLawSlugToShortName(lawSlug)
  
  const lawsInfo = {
    // Principales
    'CE': { name: 'Constitución Española', description: 'La ley fundamental del Estado' },
    'LRJSP': { name: 'Ley 40/2015 del Régimen Jurídico del Sector Público', description: 'Organización del sector público' },
    'Ley 40/2015': { name: 'Ley 40/2015 del Régimen Jurídico del Sector Público', description: 'Organización del sector público' },
    'Ley 39/2015': { name: 'Ley 39/2015 del Procedimiento Administrativo Común', description: 'Procedimiento administrativo común' },
    'Ley 19/2013': { name: 'Ley 19/2013 de Transparencia', description: 'Transparencia y buen gobierno' },
    
    // Códigos
    'Código Civil': { name: 'Código Civil', description: 'Derecho privado español' },
    'Código Penal': { name: 'Código Penal', description: 'Delitos y penas' },
    
    // Otras leyes
    'Ley 7/1985': { name: 'Ley 7/1985 Reguladora de las Bases del Régimen Local', description: 'Régimen local' },
    'Ley 50/1997': { name: 'Ley 50/1997 del Gobierno', description: 'Organización y funcionamiento del Gobierno' },
    'Ley 2/2014': { name: 'Ley 2/2014 de la Acción y del Servicio Exterior del Estado', description: 'Acción exterior' },
    'Ley 25/2014': { name: 'Ley 25/2014 de Tratados y otros Acuerdos Internacionales', description: 'Tratados internacionales' },
    'Ley 38/2015': { name: 'Ley 38/2015 del Sector Ferroviario', description: 'Regulación ferroviaria' },
    
    // Laborales
    'Estatuto de los Trabajadores': { name: 'Estatuto de los Trabajadores', description: 'Derechos laborales' },
    
    // Europeas
    'TUE': { name: 'Tratado de la Unión Europea', description: 'Tratado fundacional UE' },
    'TFUE': { name: 'Tratado de Funcionamiento de la Unión Europea', description: 'Funcionamiento UE' },
    
    // 🆕 NUEVAS SEGÚN TU BD
    'Gobierno Abierto': { name: 'Gobierno Abierto', description: 'Principios de gobierno abierto y transparencia' },
    'Agenda 2030': { name: 'Agenda 2030', description: 'Objetivos de Desarrollo Sostenible' },
    'Orden HFP/134/2018': { name: 'Orden HFP/134/2018', description: 'Normas presupuestarias' },
    
    // Real Decretos
    'RD 364/1995': { name: 'Real Decreto 364/1995', description: 'Reglamento General de Ingreso del Personal al Servicio de la Administración General del Estado' },
    
    // 🏛️ TEMA 4 - PODER JUDICIAL (NUEVAS)
    'LO 6/1985': { name: 'Ley Orgánica 6/1985 del Poder Judicial', description: 'Organización y funcionamiento de Juzgados y Tribunales' },
    'LO 3/1981': { name: 'Ley Orgánica 3/1981 del Defensor del Pueblo', description: 'Estatuto del Defensor del Pueblo' },
    'Ley 50/1981': { name: 'Ley 50/1981 del Estatuto Orgánico del Ministerio Fiscal', description: 'Estatuto del Ministerio Fiscal' },
    
    // Protocolos y reglamentos
    'Protocolo nº 1': { name: 'Protocolo nº 1', description: 'Protocolo europeo' },
    'Protocolo nº 2': { name: 'Protocolo nº 2', description: 'Protocolo europeo' },
    'Reglamento (CE) nº 1049/2001': { name: 'Reglamento (CE) nº 1049/2001', description: 'Acceso a documentos' },
    'Reglamento (UE, Euratom) 2018/1046': { name: 'Reglamento (UE, Euratom) 2018/1046', description: 'Reglamento financiero UE' }
  }
  
  return lawsInfo[lawShortName] || { 
    name: lawShortName, 
    description: `Test de ${lawShortName}` 
  }
}

// 🔧 FUNCIÓN: Generar slug desde short_name (mantener para compatibilidad)
export function generateLawSlug(shortName) {
  if (!shortName) return 'unknown'
  
  // Mapeo inverso para casos especiales
  const reverseMapping = {
    'Gobierno Abierto': 'gobierno-abierto',
    'Agenda 2030': 'agenda-2030',
    'Orden HFP/134/2018': 'orden-hfp-134-2018',
    'Protocolo nº 1': 'protocolo-1',
    'Protocolo nº 2': 'protocolo-2',
    'Reglamento (CE) nº 1049/2001': 'reglamento-ce-1049-2001',
    'Reglamento (UE, Euratom) 2018/1046': 'reglamento-ue-2018-1046',
    'LRJSP': 'ley-40-2015', // LRJSP redirect to canonical
    'Ley 39/2015': 'ley-39-2015',
    'CE': 'constitucion-espanola', // CE redirect to canonical
    'TUE': 'tue',
    'TFUE': 'tfue',
    'Código Civil': 'codigo-civil',
    'Código Penal': 'codigo-penal',
    'Estatuto de los Trabajadores': 'estatuto-trabajadores',
    // Real Decretos
    'RD 364/1995': 'rd-364-1995',
    
    // 🏛️ TEMA 4 - PODER JUDICIAL (NUEVOS)
    'LO 6/1985': 'lo-6-1985',
    'LO 3/1981': 'lo-3-1981',
    'Ley 50/1981': 'ley-50-1981'
  }
  
  if (reverseMapping[shortName]) {
    return reverseMapping[shortName]
  }
  
  // Generación automática para el resto
  return shortName
    .toLowerCase()
    .replace(/\s+/g, '-')           // Espacios a guiones
    .replace(/[^a-z0-9\-]/g, '-')   // Caracteres especiales a guiones
    .replace(/-+/g, '-')            // Múltiples guiones a uno
    .replace(/^-|-$/g, '')          // Quitar guiones al inicio/final
}

// 🔧 FUNCIÓN: Validar que un slug es válido
export function isValidLawSlug(lawSlug) {
  const shortName = mapLawSlugToShortName(lawSlug)
  return shortName !== lawSlug || getLawInfo(lawSlug).name !== lawSlug
}

// 🎯 FUNCIÓN: Verificar si es URL canonical
export function isCanonicalUrl(lawSlug, shortName) {
  const canonicalSlug = getCanonicalSlug(shortName)
  return lawSlug === canonicalSlug
}