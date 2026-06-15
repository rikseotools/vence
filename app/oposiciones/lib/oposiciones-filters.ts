// app/oposiciones/lib/oposiciones-filters.ts
// Filtros y mapeos para el directorio de nuestras oposiciones

export type FilterType = 'ccaa' | 'subgrupo' | 'tipo' | 'estado' | 'position'

export interface OposicionFilter {
  type: FilterType
  slug: string
  label: string
  value: string
  seoTitle: string
  seoDescription: string
}

// CCAA: extraer de slug de oposición
export const CCAA_FILTERS: Record<string, OposicionFilter> = {
  'madrid': { type: 'ccaa', slug: 'madrid', label: 'Madrid', value: 'madrid', seoTitle: 'Oposiciones en Madrid 2026', seoDescription: 'Convocatorias de oposiciones C1 y C2 en la Comunidad de Madrid y Ayuntamiento. Plazas, fechas y temarios actualizados.' },
  'andalucia': { type: 'ccaa', slug: 'andalucia', label: 'Andalucía', value: 'andalucia', seoTitle: 'Oposiciones en Andalucía 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo y Administrativo de la Junta de Andalucía. Plazas y temarios.' },
  'canarias': { type: 'ccaa', slug: 'canarias', label: 'Canarias', value: 'canarias', seoTitle: 'Oposiciones en Canarias 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo del Gobierno de Canarias. Plazas, inscripción y temario.' },
  'valencia': { type: 'ccaa', slug: 'valencia', label: 'Comunidad Valenciana', value: 'valencia', seoTitle: 'Oposiciones en la Comunidad Valenciana 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo de la Generalitat Valenciana y Ayuntamiento.' },
  'castilla-y-leon': { type: 'ccaa', slug: 'castilla-y-leon', label: 'Castilla y León', value: 'cyl', seoTitle: 'Oposiciones en Castilla y León 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo de la Junta de Castilla y León.' },
  'castilla-la-mancha': { type: 'ccaa', slug: 'castilla-la-mancha', label: 'Castilla-La Mancha', value: 'clm', seoTitle: 'Oposiciones en Castilla-La Mancha 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo de la JCCM.' },
  'murcia': { type: 'ccaa', slug: 'murcia', label: 'Región de Murcia', value: 'carm', seoTitle: 'Oposiciones en Murcia 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo de la Comunidad Autónoma de Murcia.' },
  'aragon': { type: 'ccaa', slug: 'aragon', label: 'Aragón', value: 'aragon', seoTitle: 'Oposiciones en Aragón 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo del Gobierno de Aragón.' },
  'extremadura': { type: 'ccaa', slug: 'extremadura', label: 'Extremadura', value: 'extremadura', seoTitle: 'Oposiciones en Extremadura 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo de la Junta de Extremadura.' },
  'galicia': { type: 'ccaa', slug: 'galicia', label: 'Galicia', value: 'galicia', seoTitle: 'Oposiciones en Galicia 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo de la Xunta de Galicia.' },
  'baleares': { type: 'ccaa', slug: 'baleares', label: 'Islas Baleares', value: 'baleares', seoTitle: 'Oposiciones en Baleares 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo del Govern de les Illes Balears.' },
  'asturias': { type: 'ccaa', slug: 'asturias', label: 'Asturias', value: 'asturias', seoTitle: 'Oposiciones en Asturias 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo del Principado de Asturias.' },
  'cantabria': { type: 'ccaa', slug: 'cantabria', label: 'Cantabria', value: 'cantabria', seoTitle: 'Oposiciones en Cantabria 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo del Gobierno de Cantabria.' },
  'navarra': { type: 'ccaa', slug: 'navarra', label: 'Navarra', value: 'navarra', seoTitle: 'Oposiciones en Navarra 2026', seoDescription: 'Convocatorias de Administrativo del Gobierno de Navarra. 585 plazas.' },
  'la-rioja': { type: 'ccaa', slug: 'la-rioja', label: 'La Rioja', value: 'la-rioja', seoTitle: 'Oposiciones en La Rioja 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo del Gobierno de La Rioja.' },
  'pais-vasco': { type: 'ccaa', slug: 'pais-vasco', label: 'País Vasco', value: 'pais-vasco', seoTitle: 'Oposiciones en el País Vasco 2026', seoDescription: 'Convocatorias de oposiciones en Osakidetza y Gobierno Vasco.' },
  'cataluna': { type: 'ccaa', slug: 'cataluna', label: 'Cataluña', value: 'cataluna', seoTitle: 'Oposiciones en Cataluña 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo de la Generalitat de Catalunya y TCAE del ICS.' },
  'ceuta': { type: 'ccaa', slug: 'ceuta', label: 'Ceuta', value: 'ceuta', seoTitle: 'Oposiciones en Ceuta 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo de la Ciudad Autónoma de Ceuta.' },
  'melilla': { type: 'ccaa', slug: 'melilla', label: 'Melilla', value: 'melilla', seoTitle: 'Oposiciones en Melilla 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo de la Ciudad Autónoma de Melilla.' },
}

export const SUBGRUPO_FILTERS: Record<string, OposicionFilter> = {
  'a2': { type: 'subgrupo', slug: 'a2', label: 'Subgrupo A2', value: 'A2', seoTitle: 'Oposiciones Subgrupo A2 (Enfermería, Fisioterapia) 2026', seoDescription: 'Convocatorias de Enfermería y otras profesiones sanitarias (A2) en España.' },
  'c1': { type: 'subgrupo', slug: 'c1', label: 'Subgrupo C1', value: 'C1', seoTitle: 'Oposiciones Subgrupo C1 (Administrativo) 2026', seoDescription: 'Convocatorias de Administrativo (C1) en España. Estado, Justicia y CCAA.' },
  'c2': { type: 'subgrupo', slug: 'c2', label: 'Subgrupo C2', value: 'C2', seoTitle: 'Oposiciones Subgrupo C2 (Auxiliar Administrativo, TCAE) 2026', seoDescription: 'Todas las convocatorias de Auxiliar Administrativo y TCAE (C2) en España.' },
}

export const TIPO_FILTERS: Record<string, OposicionFilter> = {
  'estado': { type: 'tipo', slug: 'estado', label: 'Administración del Estado', value: 'estado', seoTitle: 'Oposiciones del Estado 2026', seoDescription: 'Convocatorias de la Administración General del Estado. Auxiliar, Administrativo, Justicia.' },
  'autonomicas': { type: 'tipo', slug: 'autonomicas', label: 'Autonómicas', value: 'autonomicas', seoTitle: 'Oposiciones Autonómicas 2026', seoDescription: 'Convocatorias de oposiciones en Comunidades Autónomas. Auxiliar Administrativo, Administrativo y Sanidad.' },
  'sanidad': { type: 'tipo', slug: 'sanidad', label: 'Sanidad', value: 'sanidad', seoTitle: 'Oposiciones de Sanidad 2026', seoDescription: 'Convocatorias de Enfermería, TCAE y Celador en los servicios de salud de España.' },
  'seguridad': { type: 'tipo', slug: 'seguridad', label: 'Fuerzas de Seguridad', value: 'seguridad', seoTitle: 'Oposiciones Fuerzas de Seguridad 2026', seoDescription: 'Convocatorias de Guardia Civil, Policía Nacional, Policía Local e IIPP.' },
  'ayuntamientos': { type: 'tipo', slug: 'ayuntamientos', label: 'Ayuntamientos', value: 'ayuntamientos', seoTitle: 'Oposiciones en Ayuntamientos 2026', seoDescription: 'Convocatorias de Auxiliar Administrativo en ayuntamientos de España.' },
  'justicia': { type: 'tipo', slug: 'justicia', label: 'Justicia', value: 'justicia', seoTitle: 'Oposiciones de Justicia 2026', seoDescription: 'Convocatorias de Auxilio Judicial, Tramitación Procesal y Gestión Procesal.' },
}

export const ESTADO_FILTERS: Record<string, OposicionFilter> = {
  'inscripcion-abierta': { type: 'estado', slug: 'inscripcion-abierta', label: 'Inscripción abierta', value: 'inscripcion_abierta', seoTitle: 'Oposiciones con Inscripción Abierta 2026', seoDescription: 'Convocatorias de oposiciones con plazo de inscripción abierto ahora mismo.' },
  'proximos-examenes': { type: 'estado', slug: 'proximos-examenes', label: 'Próximos exámenes', value: 'pendiente_examen', seoTitle: 'Próximos Exámenes de Oposiciones 2026', seoDescription: 'Oposiciones con fecha de examen próxima. Prepárate a tiempo.' },
}

export function detectFilter(slug: string): OposicionFilter | null {
  return CCAA_FILTERS[slug] ?? SUBGRUPO_FILTERS[slug] ?? TIPO_FILTERS[slug] ?? ESTADO_FILTERS[slug] ?? null
}

export function getAllFilterSlugs(): string[] {
  return [
    ...Object.keys(CCAA_FILTERS),
    ...Object.keys(SUBGRUPO_FILTERS),
    ...Object.keys(TIPO_FILTERS),
    ...Object.keys(ESTADO_FILTERS),
  ]
}

// Mapear oposición a CCAA slug para filtrado
export function oposicionToCcaa(opoSlug: string): string | null {
  const map: Record<string, string> = {
    'administrativo-estado': 'estado',
    'auxiliar-administrativo-estado': 'estado',
    'auxiliar-administrativo-universidad-uned': 'estado',
    'auxiliar-administrativo-universidad-complutense': 'madrid',
    'auxiliar-administrativo-universidad-alcala': 'madrid',
    'auxiliar-administrativo-ayuntamiento-madrid': 'madrid',
    'auxiliar-administrativo-diputacion-cordoba': 'andalucia',
    'auxiliar-administrativo-ayuntamiento-sevilla': 'andalucia',
    'auxilio-judicial': 'justicia',
    'tramitacion-procesal': 'justicia',
    'auxiliar-administrativo-madrid': 'madrid',
    'auxiliar-administrativo-andalucia': 'andalucia',
    'auxiliar-administrativo-canarias': 'canarias',
    'auxiliar-administrativo-valencia': 'valencia',
    'auxiliar-administrativo-ayuntamiento-valencia': 'valencia',
    'auxiliar-administrativo-cyl': 'castilla-y-leon',
    'auxiliar-administrativo-clm': 'castilla-la-mancha',
    'auxiliar-administrativo-carm': 'murcia',
    'auxiliar-administrativo-aragon': 'aragon',
    'auxiliar-administrativo-extremadura': 'extremadura',
    'auxiliar-administrativo-galicia': 'galicia',
    'administrativo-galicia': 'galicia',
    'auxiliar-administrativo-baleares': 'baleares',
    'auxiliar-administrativo-asturias': 'asturias',
    'auxiliar-administrativo-cantabria': 'cantabria',
    'administrativo-navarra': 'navarra',
    'auxiliar-administrativo-la-rioja': 'la-rioja',
    'enfermero-sas-andalucia': 'andalucia',
    'tcae-sermas-madrid': 'madrid',
    'celador-sermas-madrid': 'madrid',
    'auxiliar-administrativo-sermas': 'madrid',
    'celador-sescam-clm': 'castilla-la-mancha',
    'celador-scs-canarias': 'canarias',
    'celador-galicia': 'galicia',
    'celador-sas': 'andalucia',
    'auxiliar-administrativo-scs-canarias': 'canarias',
    'auxiliar-enfermeria-osakidetza': 'pais-vasco',
    'auxiliar-administrativo-pais-vasco': 'pais-vasco',
    'administrativo-pais-vasco': 'pais-vasco',
    'auxiliar-administrativo-catalunya': 'cataluna',
    'administrativo-gva': 'valencia',
    'auxiliar-enfermeria-gva': 'valencia',
    'tcae-aragon': 'aragon',
    'tcae-sas': 'andalucia',
    'tcae-canarias': 'canarias',
    'tcae-galicia': 'galicia',
    'tcae-murcia': 'murcia',
    'tcae-sescam': 'castilla-la-mancha',
    'tcae-extremadura': 'extremadura',
    'auxiliar-administrativo-sms': 'murcia',
    'guardia-civil': 'estado',
    'policia-nacional': 'estado',
    'policia-municipal-madrid': 'madrid',
  }
  return map[opoSlug] ?? null
}

export function oposicionToTipo(opoSlug: string): string {
  if (opoSlug.includes('guardia-civil') || opoSlug.includes('policia-nacional') || opoSlug.includes('policia-local') || opoSlug.includes('policia-municipal') || opoSlug.includes('iipp') || opoSlug.includes('mossos') || opoSlug.includes('ertzaintza')) return 'seguridad'
  if (opoSlug.includes('estado')) return 'estado'
  if (opoSlug.includes('judicial') || opoSlug.includes('procesal')) return 'justicia'
  if (opoSlug.includes('ayuntamiento')) return 'ayuntamientos'
  if (opoSlug.includes('enfermero') || opoSlug.includes('tcae') || opoSlug.includes('celador') || opoSlug.includes('sas') || opoSlug.includes('sermas') || opoSlug.includes('osakidetza')) return 'sanidad'
  return 'autonomicas'
}
