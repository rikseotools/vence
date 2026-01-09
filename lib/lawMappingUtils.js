// lib/lawMappingUtils.js - MAPEOS CENTRALIZADOS PARA TODAS LAS LEYES
// Esto evita duplicar el mapeo en diferentes archivos

// 🔧 FUNCIÓN DE NORMALIZACIÓN: Mapear nombres problemáticos de leyes
export function normalizeLawShortName(shortName) {
  // Mapeo directo de nombres problemáticos a nombres correctos en BD
  const normalizationMap = {
    'RCD': 'Reglamento del Congreso',
    'RS': 'Reglamento del Senado',
    'Reglamento Congreso': 'Reglamento del Congreso', // Unificar variantes
  };

  return normalizationMap[shortName] || shortName;
}

// 🔧 FUNCIÓN AUXILIAR: Obtener todas las variantes de un nombre de ley
export function getLawNameVariants(shortName) {
  // Para buscar en todas las variantes que existen en la BD
  const variantsMap = {
    'RCD': ['RCD', 'Reglamento del Congreso', 'Reglamento Congreso'],
    'Reglamento del Congreso': ['RCD', 'Reglamento del Congreso', 'Reglamento Congreso'],
    'RS': ['RS', 'Reglamento del Senado'],
    'Reglamento del Senado': ['RS', 'Reglamento del Senado'],
  };

  return variantsMap[shortName] || [shortName];
}

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
    'CE': 'CE', // Mapeo directo para mayúsculas
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
    'rd-365-1995': 'RD 365/1995',
    'rd-366-2007': 'RD 366/2007',
    'rd-375-2003': 'RD 375/2003',
    'rd-462-2002': 'RD 462/2002',
    'rd-829-2023': 'RD 829/2023',
    'rd-861-1986': 'RD 861/1986',
    'rd-951-2005': 'RD 951/2005',
    'rd-208-1996': 'RD 208/1996',
    'rd-210-2024': 'RD 210/2024',
    'rd-2271-2004': 'RD 2271/2004',
    'rdl-5-2015': 'RDL 5/2015',
    'trebep': 'RDL 5/2015',

    // Leyes adicionales Administrativo Estado
    'ley-10-2010': 'Ley 10/2010',
    'ley-39-2006': 'Ley 39/2006',
    'dependencia': 'Ley 39/2006',
    
    // 🆕 NUEVAS LEYES SEGÚN TU DOCUMENTACIÓN
    'gobierno-abierto': 'Gobierno Abierto',
    'agenda-2030': 'Agenda 2030',
    'orden-hfp-134-2018': 'Orden HFP/134/2018',
    'iv-plan-gobierno-abierto': 'IV Plan de Gobierno Abierto',
    'iii-plan-gobierno-abierto': 'III Plan de Gobierno Abierto',
    'i-plan-gobierno-abierto': 'I Plan Gobierno Abierto',
    'ley-4-2023': 'Ley 4/2023',
    'ley-47-2003': 'Ley 47/2003',
    'lo-2-2012': 'LO 2/2012',
    'lo-2-1980': 'LO 2/1980',
    
    // 🏛️ CONSTITUCIONAL Y TRIBUNALES
    'lotc': 'LOTC',
    'LOTC': 'LOTC', // Alias para mayúscula
    'ley-organica-tribunal-constitucional': 'LOTC',
    'lo-2-1979': 'LOTC',
    
    // 📊 PROTECCIÓN DE DATOS Y RGPD
    'reglamento-ue-2016-679': 'Reglamento UE 2016/679',
    'rgpd': 'Reglamento UE 2016/679',
    'lopd': 'LO 3/2018',
    'ley-proteccion-datos': 'LO 3/2018',
    
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

    // Reglamentos parlamentarios
    'rcd': 'Reglamento del Congreso',
    'RCD': 'Reglamento del Congreso',
    'rs': 'Reglamento del Senado',
    'RS': 'Reglamento del Senado',
    'reglamento-congreso': 'Reglamento del Congreso',
    'reglamento-senado': 'Reglamento del Senado',

    // Alias adicionales
    'transparencia': 'Ley 19/2013',
    'procedimiento-administrativo': 'Ley 39/2015',
    'regimen-juridico': 'Ley 40/2015',
    'regimen-local': 'Ley 7/1985',

    // 🆕 NUEVAS LEYES C1 ADMINISTRATIVO ESTADO (Enero 2026)
    // Leyes Orgánicas
    'lo-3-1980': 'LO 3/1980',
    'consejo-de-estado': 'LO 3/1980',
    'lo-11-1985': 'LO 11/1985',
    'lols': 'LO 11/1985',
    'libertad-sindical': 'LO 11/1985',
    'lo-6-2002': 'LO 6/2002',
    'partidos-politicos': 'LO 6/2002',
    'lo-8-1980': 'LO 8/1980',
    'lofca': 'LO 8/1980',

    // Leyes ordinarias
    'ley-7-1988': 'Ley 7/1988',
    'funcionamiento-tribunal-cuentas': 'Ley 7/1988',
    'ley-1-2000': 'Ley 1/2000',
    'lec': 'Ley 1/2000',
    'enjuiciamiento-civil': 'Ley 1/2000',
    'ley-17-2009': 'Ley 17/2009',
    'ley-33-2003': 'Ley 33/2003',
    'lpap': 'Ley 33/2003',
    'patrimonio-aapp': 'Ley 33/2003',
    'ley-34-2002': 'Ley 34/2002',
    'lssi': 'Ley 34/2002',
    'ley-11-2007': 'Ley 11/2007',
    'lae': 'Ley 11/2007',
    'ley-6-1997': 'Ley 6/1997',
    'lofage': 'Ley 6/1997',

    // Reales Decretos
    'rd-887-2006': 'RD 887/2006',
    'reglamento-subvenciones': 'RD 887/2006',
    'rd-429-1993': 'RD 429/1993',
    'rd-1398-1993': 'RD 1398/1993',
    'rd-1671-2009': 'RD 1671/2009',
    'rd-4-2010': 'RD 4/2010',
    'eni': 'RD 4/2010',
    'rd-3-2010': 'RD 3/2010',
    'ens': 'RD 3/2010',

    // Reales Decretos Legislativos
    'rdl-2-2004': 'RDL 2/2004',
    'trlrhl': 'RDL 2/2004',
    'haciendas-locales': 'RDL 2/2004',
    'rdl-1-2020': 'RDL 1/2020',
    'ley-concursal': 'RDL 1/2020',
    'rdl-3-2011': 'RDL 3/2011',
    'trlcsp': 'RDL 3/2011',
    'rdl-1-2000': 'RDL 1/2000',
    'rdl-3-2000': 'RDL 3/2000',
    'rdl-6-2019': 'RDL 6/2019',
    'rdl-13-2010': 'RDL 13/2010',

    // Más leyes C1 (Batch 2-4)
    'ley-30-1992': 'Ley 30/1992',
    'lrjpac': 'Ley 30/1992',
    'lo-4-2015': 'LO 4/2015',
    'seguridad-ciudadana': 'LO 4/2015',
    'ley-7-2007': 'Ley 7/2007',
    'ebep-original': 'Ley 7/2007',
    'ley-39-1988': 'Ley 39/1988',
    'ley-22-2003': 'Ley 22/2003',
    'ley-29-2011': 'Ley 29/2011',
    'ley-70-1978': 'Ley 70/1978',
    'ley-15-2015': 'Ley 15/2015',
    'jurisdiccion-voluntaria': 'Ley 15/2015',
    'lo-4-2000': 'LO 4/2000',
    'extranjeria': 'LO 4/2000',
    'ley-37-2007': 'Ley 37/2007',
    'risp': 'Ley 37/2007',
    'ley-38-1988': 'Ley 38/1988',
    'lo-2-2006': 'LO 2/2006',
    'loe': 'LO 2/2006',
    'lo-9-1983': 'LO 9/1983',
    'derecho-reunion': 'LO 9/1983',
    'lo-5-1992': 'LO 5/1992',
    'lortad': 'LO 5/1992',
    'ley-51-2003': 'Ley 51/2003',
    'liondau': 'Ley 51/2003',
    'ley-8-1994': 'Ley 8/1994',
    'ces': 'Ley 8/1994',
    'lo-11-1995': 'LO 11/1995',
    'ley-6-2023': 'Ley 6/2023',
    'ley-3-2015': 'Ley 3/2015',
    'alto-cargo': 'Ley 3/2015',
    'lo-1-2025': 'LO 1/2025',
    'eficiencia-justicia': 'LO 1/2025',
    'ley-13-2010': 'Ley 13/2010',

    // RD adicionales
    'rd-725-1989': 'RD 725/1989',
    'rd-221-1987': 'RD 221/1987',
    'rd-349-2001': 'RD 349/2001',
    'rd-1084-1990': 'RD 1084/1990',
    'rd-456-1986': 'RD 456/1986',
    'rd-1410-1995': 'RD 1410/1995',
    'rd-776-2011': 'RD 776/2011',
    'rd-640-1987': 'RD 640/1987',
    'rd-127-2015': 'RD 127/2015',
    'rd-118-2001': 'RD 118/2001',
    'rd-2225-1993': 'RD 2225/1993',
    'rd-577-1997': 'RD 577/1997',
    'rd-1567-1985': 'RD 1567/1985',
    'rd-1230-2023': 'RD 1230/2023',
    'rd-1009-2023': 'RD 1009/2023',
    'rd-209-2024': 'RD 209/2024',
    'rd-501-2024': 'RD 501/2024',
    'rd-246-2024': 'RD 246/2024',
    'rd-1118-2024': 'RD 1118/2024',
    'rd-1184-2024': 'RD 1184/2024',
    'rd-2169-1984': 'RD 2169/1984',
    'rd-2720-1998': 'RD 2720/1998',
    'contratos-duracion-determinada': 'RD 2720/1998',

    // RDL adicionales
    'rdl-1-2000': 'RDL 1/2000',
    'ss-fuerzas-armadas': 'RDL 1/2000',
    'rdl-3-2000': 'RDL 3/2000',
    'ss-administracion-justicia': 'RDL 3/2000',

    // Leyes antiguas
    'ley-10-1965': 'Ley 10/1965',

    // Órdenes ministeriales
    'orden-pre-1576-2002': 'Orden PRE/1576/2002',
    'orden-pcm-7-2021': 'Orden PCM/7/2021',

    // 🆕 Temas técnicos/informática
    'procesadores-de-texto': 'Procesadores de texto',
    'procesadores-texto': 'Procesadores de texto',
    'informatica-basica': 'Informática Básica',
    'informática-básica': 'Informática Básica',
    'explorador-de-windows': 'Explorador de Windows',
    'windows-10': 'Windows 10',
    'portal-de-internet': 'Portal de Internet',
    
    // 📊 Leyes ficticias específicas
    'hojas-de-calculo-excel': 'Hojas de cálculo. Excel',
    'hojas-de-calculo': 'Hojas de cálculo. Excel',
    'excel': 'Hojas de cálculo. Excel',
    'la-red-internet': 'La Red Internet',
    'red-internet': 'La Red Internet',
    'internet': 'La Red Internet',
    'base-de-datos-access': 'Base de datos: Access',
    'bases-de-datos-access': 'Base de datos: Access',
    'correo-electronico': 'Correo electrónico',
    'correo-electrónico': 'Correo electrónico',
    
    // 🔧 MAPEOS DIRECTOS PARA NOTIFICACIONES (sin guiones)
    'I Plan Gobierno Abierto': 'I Plan Gobierno Abierto',
    'Ley 50/1997': 'Ley 50/1997',
    'Ley 19/2013': 'Ley 19/2013',
    'Agenda 2030': 'Agenda 2030'
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
      // Real Decreto-Ley: 'rdl-670-1987' → 'RDL 670/1987'
      {
        regex: /^rdl-(\d+)-(\d+)$/,
        transform: (match) => `RDL ${match[1]}/${match[2]}`
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
      },
      // Orden ministerial: 'orden-dsa-819-2020' → 'Orden DSA/819/2020'
      {
        regex: /^orden-([a-z]+)-(\d+)-(\d+)$/,
        transform: (match) => `Orden ${match[1].toUpperCase()}/${match[2]}/${match[3]}`
      },
      // Reglamento UE: 'reglamento-ue-2016-679' → 'Reglamento UE 2016/679'
      {
        regex: /^reglamento-ue-(\d+)-(\d+)$/,
        transform: (match) => `Reglamento UE ${match[1]}/${match[2]}`
      },
      // Plan especial: 'iv-plan-gobierno-abierto' → 'IV Plan de Gobierno Abierto'
      {
        regex: /^(i{1,3}v?|v|vi{1,3})-plan-(.+)$/,
        transform: (match) => `${match[1].toUpperCase()} Plan de ${match[2].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`
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
    
    // Temas técnicos/informática
    'Procesadores de texto': 'procesadores-de-texto',
    'Informática Básica': 'informatica-basica', 
    'Explorador de Windows': 'explorador-de-windows',
    'Windows 10': 'windows-10',
    'Portal de Internet': 'portal-de-internet',
    
    // Leyes ficticias específicas
    'Hojas de cálculo. Excel': 'hojas-de-calculo-excel',
    'La Red Internet': 'la-red-internet',
    'Base de datos: Access': 'base-de-datos-access',
    'Correo electrónico': 'correo-electronico',
    
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
    'I Plan Gobierno Abierto': 'i-plan-gobierno-abierto',
    'Orden HFP/134/2018': 'orden-hfp-134-2018',
    'Ley 4/2023': 'ley-4-2023',
    'IV Plan de Gobierno Abierto': 'iv-plan-gobierno-abierto',
    'III Plan de Gobierno Abierto': 'iii-plan-gobierno-abierto',
    'Ley 47/2003': 'ley-47-2003',
    'LOTC': 'lotc',
    'Reglamento UE 2016/679': 'reglamento-ue-2016-679'
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
    'I Plan Gobierno Abierto': { name: 'I Plan Gobierno Abierto', description: 'Primer Plan de Gobierno Abierto de España' },
    'Orden HFP/134/2018': { name: 'Orden HFP/134/2018', description: 'Normas presupuestarias' },
    'IV Plan de Gobierno Abierto': { name: 'IV Plan de Gobierno Abierto', description: 'Cuarto Plan de Gobierno Abierto de España' },
    'III Plan de Gobierno Abierto': { name: 'III Plan de Gobierno Abierto', description: 'Tercer Plan de Gobierno Abierto de España' },
    'Ley 47/2003': { name: 'Ley 47/2003 General Presupuestaria', description: 'Régimen presupuestario del sector público' },
    
    // 🏛️ CONSTITUCIONAL Y TRIBUNALES
    'LOTC': { name: 'Ley Orgánica del Tribunal Constitucional', description: 'Organización y funcionamiento del Tribunal Constitucional' },
    
    // 📊 PROTECCIÓN DE DATOS Y NUEVAS LEYES
    'Reglamento UE 2016/679': { name: 'Reglamento General de Protección de Datos (RGPD)', description: 'Protección de datos personales en la UE' },
    'Ley 15/2022': { name: 'Ley 15/2022 Integral para la Igualdad de Trato', description: 'Medidas para la igualdad de trato y la no discriminación' },
    'RDL 670/1987': { name: 'Real Decreto-Ley 670/1987', description: 'Gestión y control de la Seguridad Social' },
    'RD 2271/2004': { name: 'Real Decreto 2271/2004', description: 'Reglamento del seguro de responsabilidad civil del cazador' },
    'RD 2073/1999': { name: 'Real Decreto 2073/1999', description: 'Reglamento de protección de los animales durante el transporte' },
    'Orden DSA/819/2020': { name: 'Orden DSA/819/2020', description: 'Medidas administrativas del Ministerio de Derechos Sociales' },
    'RDL 1/2013': { name: 'Real Decreto-Ley 1/2013', description: 'Medidas urgentes para reforzar la protección a los deudores hipotecarios' },
    'Ley 4/2023': { name: 'Ley 4/2023 para la Igualdad Real y Efectiva', description: 'Derechos de las personas trans y garantía de los derechos LGTBI' },
    'RDL 6/2023': { name: 'Real Decreto-Ley 6/2023', description: 'Medidas urgentes para la modernización de la Administración Pública' },
    'RDL 4/2000': { name: 'Real Decreto-Ley 4/2000', description: 'Medidas urgentes de liberalización en el sector inmobiliario' },
    'Ley 39/2006': { name: 'Ley 39/2006 de Promoción de la Autonomía Personal', description: 'Atención a las personas en situación de dependencia' },
    'Ley 29/1998': { name: 'Ley 29/1998 de la Jurisdicción Contencioso-administrativa', description: 'Procedimiento contencioso-administrativo' },
    'LO 3/2007': { name: 'Ley Orgánica 3/2007 para la Igualdad Efectiva', description: 'Igualdad efectiva de mujeres y hombres' },
    'LO 3/2018': { name: 'Ley Orgánica 3/2018 de Protección de Datos', description: 'Protección de Datos Personales y garantía de los derechos digitales' },
    'Ley 47/2003': { name: 'Ley 47/2003 General Presupuestaria', description: 'Régimen presupuestario del sector público' },
    'RDL 5/2015': { name: 'Real Decreto Legislativo 5/2015 - Estatuto Básico del Empleado Público (TREBEP)', description: 'Texto refundido del Estatuto Básico del Empleado Público' },
    
    // Real Decretos
    'RD 364/1995': { name: 'Real Decreto 364/1995', description: 'Reglamento General de Ingreso del Personal al Servicio de la Administración General del Estado' },
    'RD 365/1995': { name: 'Real Decreto 365/1995', description: 'Reglamento de Situaciones Administrativas de los Funcionarios Civiles' },
    'RD 366/2007': { name: 'Real Decreto 366/2007', description: 'Condiciones de accesibilidad y no discriminación de personas con discapacidad' },
    'RD 375/2003': { name: 'Real Decreto 375/2003', description: 'Reglamento General del Mutualismo Administrativo' },
    'RD 462/2002': { name: 'Real Decreto 462/2002', description: 'Indemnizaciones por razón del servicio' },
    'RD 829/2023': { name: 'Real Decreto 829/2023', description: 'Reestructuración de los departamentos ministeriales' },
    'RD 861/1986': { name: 'Real Decreto 861/1986', description: 'Régimen de retribuciones de los funcionarios de Administración Local' },
    'RD 951/2005': { name: 'Real Decreto 951/2005', description: 'Marco general para la mejora de la calidad en la AGE' },
    'RD 208/1996': { name: 'Real Decreto 208/1996', description: 'Servicios de información administrativa y atención al ciudadano' },
    'RD 210/2024': { name: 'Real Decreto 210/2024', description: 'Estructura orgánica del Ministerio para la Transformación Digital' },
    'RD 2271/2004': { name: 'Real Decreto 2271/2004', description: 'Acceso al empleo público de personas con discapacidad' },
    'Ley 10/2010': { name: 'Ley 10/2010', description: 'Prevención del blanqueo de capitales y financiación del terrorismo' },

    // 🏛️ TEMA 4 - PODER JUDICIAL (NUEVAS)
    'LO 6/1985': { name: 'Ley Orgánica 6/1985 del Poder Judicial', description: 'Organización y funcionamiento de Juzgados y Tribunales' },
    'LO 3/1981': { name: 'Ley Orgánica 3/1981 del Defensor del Pueblo', description: 'Estatuto del Defensor del Pueblo' },
    'Ley 50/1981': { name: 'Ley 50/1981 del Estatuto Orgánico del Ministerio Fiscal', description: 'Estatuto del Ministerio Fiscal' },

    // 🆕 NUEVAS LEYES C1 ADMINISTRATIVO ESTADO (Enero 2026)
    'LO 3/1980': { name: 'Ley Orgánica 3/1980 del Consejo de Estado', description: 'Supremo órgano consultivo del Gobierno' },
    'LO 11/1985': { name: 'Ley Orgánica 11/1985 de Libertad Sindical', description: 'LOLS - Derecho a la libertad sindical' },
    'LO 6/2002': { name: 'Ley Orgánica 6/2002 de Partidos Políticos', description: 'Creación, organización y disolución de partidos' },
    'LO 8/1980': { name: 'Ley Orgánica 8/1980 de Financiación de las CCAA', description: 'LOFCA - Financiación autonómica' },
    'Ley 7/1988': { name: 'Ley 7/1988 de Funcionamiento del Tribunal de Cuentas', description: 'Procedimientos y funcionamiento del Tribunal de Cuentas' },
    'Ley 1/2000': { name: 'Ley 1/2000 de Enjuiciamiento Civil', description: 'LEC - Proceso civil' },
    'Ley 17/2009': { name: 'Ley 17/2009 sobre el libre acceso a las actividades de servicios', description: 'Transposición Directiva de Servicios' },
    'Ley 33/2003': { name: 'Ley 33/2003 del Patrimonio de las AAPP', description: 'LPAP - Régimen patrimonial de las AAPP' },
    'Ley 34/2002': { name: 'Ley 34/2002 de servicios de la sociedad de la información', description: 'LSSI - Comercio electrónico' },
    'Ley 11/2007': { name: 'Ley 11/2007 de acceso electrónico de los ciudadanos', description: 'LAE - Administración electrónica' },
    'Ley 6/1997': { name: 'Ley 6/1997 de Organización y Funcionamiento de la AGE', description: 'LOFAGE - Organización AGE (derogada parcialmente)' },
    'RD 887/2006': { name: 'Real Decreto 887/2006 Reglamento de Subvenciones', description: 'Desarrollo de la Ley 38/2003' },
    'RD 429/1993': { name: 'Real Decreto 429/1993 de Responsabilidad Patrimonial', description: 'Reglamento de procedimientos de responsabilidad' },
    'RD 1398/1993': { name: 'Real Decreto 1398/1993 del Procedimiento Sancionador', description: 'Reglamento de potestad sancionadora' },
    'RD 1671/2009': { name: 'Real Decreto 1671/2009 de desarrollo de la Ley 11/2007', description: 'Desarrollo administración electrónica' },
    'RD 4/2010': { name: 'Real Decreto 4/2010 Esquema Nacional de Interoperabilidad', description: 'ENI - Interoperabilidad' },
    'RD 3/2010': { name: 'Real Decreto 3/2010 Esquema Nacional de Seguridad', description: 'ENS - Seguridad' },
    'RDL 2/2004': { name: 'Real Decreto Legislativo 2/2004 de Haciendas Locales', description: 'TRLRHL - Texto refundido Haciendas Locales' },
    'RDL 1/2020': { name: 'Real Decreto Legislativo 1/2020 Ley Concursal', description: 'Texto refundido Ley Concursal' },
    
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
    'Ley 4/2023': 'ley-4-2023',
    'Protocolo nº 1': 'protocolo-1',
    'Protocolo nº 2': 'protocolo-2',
    'Reglamento (CE) nº 1049/2001': 'reglamento-ce-1049-2001',
    'Reglamento (UE, Euratom) 2018/1046': 'reglamento-ue-2018-1046',
    'LPAC': 'ley-39-2015', // LPAC redirect to canonical
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
    'RD 365/1995': 'rd-365-1995',
    'RD 366/2007': 'rd-366-2007',
    'RD 375/2003': 'rd-375-2003',
    'RD 462/2002': 'rd-462-2002',
    'RD 829/2023': 'rd-829-2023',
    'RD 861/1986': 'rd-861-1986',
    'RD 951/2005': 'rd-951-2005',
    'RD 208/1996': 'rd-208-1996',
    'RD 210/2024': 'rd-210-2024',
    'RD 2271/2004': 'rd-2271-2004',
    'Ley 10/2010': 'ley-10-2010',
    'Ley 39/2006': 'ley-39-2006',

    // 🏛️ TEMA 4 - PODER JUDICIAL (NUEVOS)
    'LO 6/1985': 'lo-6-1985',
    'LO 3/1981': 'lo-3-1981',
    'Ley 50/1981': 'ley-50-1981',
    
    // 🆕 NUEVAS LEYES ESPECÍFICAS
    'I Plan Gobierno Abierto': 'i-plan-gobierno-abierto',
    'IV Plan de Gobierno Abierto': 'iv-plan-gobierno-abierto',
    'III Plan de Gobierno Abierto': 'iii-plan-gobierno-abierto',
    'Ley 47/2003': 'ley-47-2003',
    'LOTC': 'lotc',
    'Reglamento UE 2016/679': 'reglamento-ue-2016-679',
    'LO 3/2007': 'lo-3-2007',
    'LO 3/2018': 'lo-3-2018',

    // 🆕 NUEVAS LEYES C1 ADMINISTRATIVO ESTADO (Enero 2026)
    'LO 3/1980': 'lo-3-1980',
    'LO 11/1985': 'lo-11-1985',
    'LO 6/2002': 'lo-6-2002',
    'LO 8/1980': 'lo-8-1980',
    'Ley 7/1988': 'ley-7-1988',
    'Ley 1/2000': 'ley-1-2000',
    'Ley 17/2009': 'ley-17-2009',
    'Ley 33/2003': 'ley-33-2003',
    'Ley 34/2002': 'ley-34-2002',
    'Ley 11/2007': 'ley-11-2007',
    'Ley 6/1997': 'ley-6-1997',
    'RD 887/2006': 'rd-887-2006',
    'RD 429/1993': 'rd-429-1993',
    'RD 1398/1993': 'rd-1398-1993',
    'RD 1671/2009': 'rd-1671-2009',
    'RD 4/2010': 'rd-4-2010',
    'RD 3/2010': 'rd-3-2010',
    'RDL 2/2004': 'rdl-2-2004',
    'RDL 1/2020': 'rdl-1-2020'
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