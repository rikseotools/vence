/**
 * Mapeos y utilidades para filtros de convocatorias
 */

// Comunidades Autónomas
export const CCAA_MAP: Record<string, string> = {
  'andalucia': 'Andalucía',
  'aragon': 'Aragón',
  'asturias': 'Asturias',
  'islas-baleares': 'Islas Baleares',
  'baleares': 'Islas Baleares',
  'canarias': 'Canarias',
  'cantabria': 'Cantabria',
  'castilla-la-mancha': 'Castilla-La Mancha',
  'castilla-y-leon': 'Castilla y León',
  'cataluna': 'Cataluña',
  'catalunya': 'Cataluña',
  'comunidad-valenciana': 'Comunidad Valenciana',
  'valencia': 'Comunidad Valenciana',
  'extremadura': 'Extremadura',
  'galicia': 'Galicia',
  'la-rioja': 'La Rioja',
  'rioja': 'La Rioja',
  'madrid': 'Madrid',
  'murcia': 'Murcia',
  'navarra': 'Navarra',
  'pais-vasco': 'País Vasco',
  'euskadi': 'País Vasco',
  'ceuta': 'Ceuta',
  'melilla': 'Melilla',
};

// Provincias
export const PROVINCIA_MAP: Record<string, string> = {
  'a-coruna': 'A coruña', 'coruna': 'A coruña', 'la-coruna': 'A coruña',
  'alava': 'Araba', 'araba': 'Araba', 'vitoria': 'Araba',
  'albacete': 'Albacete',
  'alicante': 'Alicante', 'alacant': 'Alicante',
  'almeria': 'Almería',
  'avila': 'Ávila',
  'badajoz': 'Badajoz',
  'barcelona': 'Barcelona',
  'bizkaia': 'Bizkaia', 'vizcaya': 'Bizkaia', 'bilbao': 'Bizkaia',
  'burgos': 'Burgos',
  'caceres': 'Cáceres',
  'cadiz': 'Cádiz',
  'castellon': 'Castellón', 'castello': 'Castellón',
  'ciudad-real': 'Ciudad real',
  'cordoba': 'Córdoba',
  'cuenca': 'Cuenca',
  'gipuzkoa': 'Gipuzkoa', 'guipuzcoa': 'Gipuzkoa', 'san-sebastian': 'Gipuzkoa',
  'girona': 'Girona', 'gerona': 'Girona',
  'granada': 'Granada',
  'guadalajara': 'Guadalajara',
  'huelva': 'Huelva',
  'huesca': 'Huesca',
  'illes-balears': 'Illes balears', 'mallorca': 'Illes balears',
  'jaen': 'Jaén',
  'leon': 'León',
  'lleida': 'Lleida', 'lerida': 'Lleida',
  'lugo': 'Lugo',
  'las-palmas': 'Las palmas', 'gran-canaria': 'Las palmas',
  'malaga': 'Málaga',
  'navarra': 'Navarra', 'pamplona': 'Navarra',
  'ourense': 'Ourense', 'orense': 'Ourense',
  'palencia': 'Palencia',
  'pontevedra': 'Pontevedra', 'vigo': 'Pontevedra',
  'salamanca': 'Salamanca',
  'segovia': 'Segovia',
  'sevilla': 'Sevilla',
  'soria': 'Soria',
  'tarragona': 'Tarragona',
  'santa-cruz-de-tenerife': 'Santa cruz de tenerife', 'tenerife': 'Santa cruz de tenerife',
  'teruel': 'Teruel',
  'toledo': 'Toledo',
  'valladolid': 'Valladolid',
  'zamora': 'Zamora',
  'zaragoza': 'Zaragoza',
};

// Ministerios
export const MINISTERIO_MAP: Record<string, string> = {
  'hacienda': 'MINISTERIO DE HACIENDA',
  'justicia': 'MINISTERIO DE LA PRESIDENCIA, JUSTICIA Y RELACIONES CON LAS CORTES',
  'interior': 'MINISTERIO DEL INTERIOR',
  'defensa': 'MINISTERIO DE DEFENSA',
  'educacion': 'MINISTERIO DE EDUCACIÓN',
  'sanidad': 'MINISTERIO DE SANIDAD',
  'trabajo': 'MINISTERIO DE TRABAJO',
  'funcion-publica': 'MINISTERIO PARA LA TRANSFORMACIÓN DIGITAL Y DE LA FUNCIÓN PÚBLICA',
  'administracion-local': 'ADMINISTRACIÓN LOCAL',
  'universidades': 'UNIVERSIDADES',
};

// Categorías
export const CATEGORIA_MAP: Record<string, { label: string; description: string }> = {
  'c2': { label: 'C2', description: 'Auxiliar Administrativo y similares. Requisito: Graduado ESO.' },
  'c1': { label: 'C1', description: 'Administrativo del Estado y similares. Requisito: Bachiller.' },
  'a2': { label: 'A2', description: 'Técnico de grado medio. Requisito: Grado universitario.' },
  'a1': { label: 'A1', description: 'Técnico de grado superior. Requisito: Licenciatura/Grado.' },
  'b': { label: 'B', description: 'Técnico Superior. Requisito: Técnico Superior FP.' },
  'grupo-c': { label: 'C1,C2', description: 'Grupos C1 y C2 de la Administración' },
  'grupo-a': { label: 'A1,A2', description: 'Grupos A1 y A2 de la Administración' },
};

// Oposiciones específicas
export const OPOSICION_MAP: Record<string, { label: string; slug: string }> = {
  'auxiliar-administrativo': { label: 'Auxiliar Administrativo del Estado', slug: 'auxiliar-administrativo-estado' },
  'auxiliar-administrativo-estado': { label: 'Auxiliar Administrativo del Estado', slug: 'auxiliar-administrativo-estado' },
  'administrativo': { label: 'Administrativo del Estado', slug: 'administrativo-estado' },
  'administrativo-estado': { label: 'Administrativo del Estado', slug: 'administrativo-estado' },
  'gestion-procesal': { label: 'Gestión Procesal', slug: 'gestion-procesal' },
  'tramitacion-procesal': { label: 'Tramitación Procesal', slug: 'tramitacion-procesal' },
  'auxilio-judicial': { label: 'Auxilio Judicial', slug: 'auxilio-judicial' },
};

// Ámbito
export const AMBITO_MAP: Record<string, { label: string; value: string }> = {
  'estatal': { label: 'Estatal (AGE)', value: 'estatal' },
  'age': { label: 'Administración General del Estado', value: 'estatal' },
  'autonomico': { label: 'Autonómico', value: 'autonomico' },
  'local': { label: 'Local (Ayuntamientos)', value: 'local' },
  'ayuntamientos': { label: 'Ayuntamientos', value: 'local' },
};

// Temporales
export const TEMPORAL_MAP: Record<string, { label: string; days: number }> = {
  'hoy': { label: 'Hoy', days: 1 },
  'esta-semana': { label: 'Esta semana', days: 7 },
  'este-mes': { label: 'Este mes', days: 30 },
  '2026': { label: 'Año 2026', days: 0 },
  '2025': { label: 'Año 2025', days: 0 },
  'nuevas': { label: 'Nuevas', days: 7 },
};

// Tipos
export const TIPO_MAP: Record<string, { label: string; value: string }> = {
  'convocatorias': { label: 'Convocatorias', value: 'convocatoria' },
  'admitidos': { label: 'Listas de Admitidos', value: 'admitidos' },
  'tribunales': { label: 'Tribunales', value: 'tribunal' },
  'resultados': { label: 'Resultados', value: 'resultado' },
};

// Municipios principales
export const MUNICIPIO_MAP: Record<string, string> = {
  'ayuntamiento-madrid': 'Madrid',
  'ayuntamiento-barcelona': 'Barcelona',
  'ayuntamiento-valencia': 'Valencia',
  'ayuntamiento-sevilla': 'Sevilla',
  'ayuntamiento-zaragoza': 'Zaragoza',
  'ayuntamiento-malaga': 'Málaga',
  'ayuntamiento-murcia': 'Murcia',
  'ayuntamiento-bilbao': 'Bilbao',
  'ayuntamiento-alicante': 'Alicante',
  'ayuntamiento-cordoba': 'Córdoba',
  'ayuntamiento-valladolid': 'Valladolid',
  'ayuntamiento-granada': 'Granada',
};

// Combinados
export const COMBINADOS_MAP: Record<string, { oposicion: string; ccaa: string; label: string }> = {};

const oposicionesForCombined = [
  { slug: 'auxiliar-administrativo', label: 'Auxiliar Administrativo', oposSlug: 'auxiliar-administrativo-estado' },
  { slug: 'administrativo', label: 'Administrativo', oposSlug: 'administrativo-estado' },
  { slug: 'c1', label: 'Grupo C1', oposSlug: null },
  { slug: 'c2', label: 'Grupo C2', oposSlug: null },
];

const ccaaForCombined = [
  'andalucia', 'aragon', 'asturias', 'islas-baleares', 'canarias', 'cantabria',
  'castilla-la-mancha', 'castilla-y-leon', 'cataluna', 'comunidad-valenciana',
  'extremadura', 'galicia', 'la-rioja', 'madrid', 'murcia', 'navarra', 'pais-vasco'
];

oposicionesForCombined.forEach(op => {
  ccaaForCombined.forEach(ccaa => {
    const combinedSlug = `${op.slug}-${ccaa}`;
    COMBINADOS_MAP[combinedSlug] = {
      oposicion: op.oposSlug || '',
      ccaa: CCAA_MAP[ccaa] || ccaa,
      label: `${op.label} en ${CCAA_MAP[ccaa] || ccaa}`
    };
  });
});

// Tipos de filtro
export type FilterType = 'ccaa' | 'provincia' | 'ministerio' | 'categoria' | 'oposicion' | 'ambito' | 'temporal' | 'tipo' | 'municipio' | 'combined' | 'unknown';

export interface FilterInfo {
  type: FilterType;
  value: string;
  label: string;
  extraFilter?: Record<string, any>;
}

/**
 * Detecta si un slug es un filtro conocido
 */
export function detectFilterType(slug: string): FilterInfo | null {
  const s = slug.toLowerCase();

  // Combinados primero
  if (COMBINADOS_MAP[s]) {
    const combined = COMBINADOS_MAP[s];
    return {
      type: 'combined',
      value: combined.oposicion,
      label: combined.label,
      extraFilter: { ccaa: combined.ccaa, oposicion: combined.oposicion }
    };
  }

  // Temporal
  if (TEMPORAL_MAP[s]) {
    return { type: 'temporal', value: s, label: TEMPORAL_MAP[s].label };
  }

  // Tipo
  if (TIPO_MAP[s]) {
    return { type: 'tipo', value: TIPO_MAP[s].value, label: TIPO_MAP[s].label };
  }

  // CCAA
  if (CCAA_MAP[s]) {
    return { type: 'ccaa', value: CCAA_MAP[s], label: CCAA_MAP[s] };
  }

  // Provincia (pero no si también es CCAA)
  if (PROVINCIA_MAP[s] && !CCAA_MAP[s]) {
    return { type: 'provincia', value: PROVINCIA_MAP[s], label: PROVINCIA_MAP[s] };
  }

  // Municipio
  if (MUNICIPIO_MAP[s]) {
    return { type: 'municipio', value: MUNICIPIO_MAP[s], label: MUNICIPIO_MAP[s] };
  }

  // Ministerio
  if (MINISTERIO_MAP[s]) {
    return { type: 'ministerio', value: MINISTERIO_MAP[s], label: formatMinisterio(MINISTERIO_MAP[s]) };
  }

  // Categoría
  if (CATEGORIA_MAP[s]) {
    return { type: 'categoria', value: CATEGORIA_MAP[s].label, label: `Grupo ${CATEGORIA_MAP[s].label}` };
  }

  // Oposición
  if (OPOSICION_MAP[s]) {
    return { type: 'oposicion', value: OPOSICION_MAP[s].slug, label: OPOSICION_MAP[s].label };
  }

  // Ámbito
  if (AMBITO_MAP[s]) {
    return { type: 'ambito', value: AMBITO_MAP[s].value, label: AMBITO_MAP[s].label };
  }

  return null; // No es un filtro conocido
}

export function formatMinisterio(nombre: string): string {
  return nombre
    .replace('MINISTERIO DE ', '')
    .replace('MINISTERIO DEL ', '')
    .replace('MINISTERIO PARA LA ', '')
    .replace('MINISTERIO PARA EL ', '')
    .split(' ')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Lista de todos los slugs de filtros conocidos para generateStaticParams
 */
export function getAllFilterSlugs(): string[] {
  const slugs: string[] = [];

  Object.keys(CCAA_MAP).forEach(s => slugs.push(s));
  Object.keys(CATEGORIA_MAP).forEach(s => slugs.push(s));
  Object.keys(OPOSICION_MAP).forEach(s => slugs.push(s));
  Object.keys(AMBITO_MAP).forEach(s => slugs.push(s));
  Object.keys(TEMPORAL_MAP).forEach(s => slugs.push(s));
  Object.keys(TIPO_MAP).forEach(s => slugs.push(s));
  Object.keys(COMBINADOS_MAP).forEach(s => slugs.push(s));

  // Provincias y municipios principales
  ['barcelona', 'sevilla', 'malaga', 'alicante', 'bilbao', 'zaragoza'].forEach(s => slugs.push(s));
  ['ayuntamiento-madrid', 'ayuntamiento-barcelona', 'ayuntamiento-valencia', 'ayuntamiento-sevilla'].forEach(s => slugs.push(s));

  return [...new Set(slugs)];
}
