// lib/temario/acentoPorOposicion.ts
//
// [T-611] El ACENTO del temario: el color con el que la página de un tema resalta lo que
// «ha caído en examen oficial» (la píldora de la cabecera, el borde de la tarjeta y su badge).
//
// Vivía copiado dentro de cada uno de los 131 `TopicContentView.tsx`, y al medirlo NO era
// ruido: son TRES familias y agrupan por tipo de oposición (medido el 06/08/2026 sobre las
// 131 copias, contando la clase del badge de la cabecera):
//
//   amber  78  · el grueso del catálogo (administración general)
//   rose   27  · administrativos autonómicos, parlamentos y cuerpos del Estado
//   red    26  · la familia sanitaria (celador · enfermero · TCAE) + Madrid/UNED
//
// Por eso se conserva como DATO y no se colapsa a un solo color al unificar el componente:
// el refactor no cambia lo que ve nadie. Colapsarlo (si se decide) es cambiar este fichero,
// no 131.
//
// ⚠️ Las clases van COMPLETAS y literales a propósito. Tailwind purga por texto: un
// `bg-${color}-100` construido en tiempo de ejecución no existe en el CSS compilado y el
// badge saldría transparente.

export type AcentoTemario = 'amber' | 'rose' | 'red'

export const ACENTO_POR_DEFECTO: AcentoTemario = 'amber'

/** Las que NO son `amber`. El resto (78) cae en el valor por defecto. */
const EXCEPCIONES: Record<string, AcentoTemario> = {
  // rose — administrativos autonómicos, parlamentos y cuerpos del Estado
  'administrativo-agencia-tributaria-canaria': 'rose',
  'administrativo-aragon': 'rose',
  'administrativo-canarias': 'rose',
  'administrativo-carm': 'rose',
  'administrativo-castilla-la-mancha': 'rose',
  'administrativo-castilla-leon': 'rose',
  'administrativo-diputacion-jaen': 'rose',
  'administrativo-la-rioja': 'rose',
  'administrativo-universidad-leon': 'rose',
  'agente-hacienda': 'rose',
  'agrupacion-profesional-servicios-publicos-carm': 'rose',
  'auxiliar-administrativo-ayuntamiento-marbella': 'rose',
  'auxiliar-administrativo-ayuntamiento-salamanca': 'rose',
  'auxiliar-administrativo-ayuntamiento-valladolid': 'rose',
  'auxiliar-administrativo-cyl': 'rose',
  'auxiliar-archivos-estado': 'rose',
  'auxiliar-biblioteca-estado': 'rose',
  'auxiliar-clinica-diputacion-sevilla': 'rose',
  'auxiliar-enfermeria-geriatria-diputacion-cadiz': 'rose',
  'auxiliar-museos-estado': 'rose',
  'ayudantes-ejecucion-penal-pais-vasco': 'rose',
  'celador-murcia': 'rose',
  'etgoa-sanidad-consumo': 'rose',
  'mecanico-conductor-estado': 'rose',
  'oficial-de-gestion-parlamento-de-andalucia': 'rose',
  'subalterno-parlamento-andalucia': 'rose',
  'ujieres-cortes-generales': 'rose',

  // red — familia sanitaria + Madrid/UNED
  'auxiliar-administrativo-madrid': 'red',
  'auxiliar-administrativo-madrid-2027': 'red',
  'auxiliar-administrativo-universidad-uned': 'red',
  'auxiliar-enfermeria-gva': 'red',
  'auxiliar-enfermeria-osakidetza': 'red',
  'celador-galicia': 'red',
  'celador-ibsalut': 'red',
  'celador-ics': 'red',
  'celador-sas': 'red',
  'celador-scs-canarias': 'red',
  'celador-sermas-madrid': 'red',
  'celador-sescam-clm': 'red',
  'enfermero-ics': 'red',
  'enfermero-sacyl': 'red',
  'enfermero-sas-andalucia': 'red',
  'enfermero-scs-canarias': 'red',
  'enfermero-scs-cantabria': 'red',
  'enfermero-sms': 'red',
  'tcae-aragon': 'red',
  'tcae-canarias': 'red',
  'tcae-extremadura': 'red',
  'tcae-galicia': 'red',
  'tcae-murcia': 'red',
  'tcae-sas': 'red',
  'tcae-sermas-madrid': 'red',
  'tcae-sescam': 'red',
}

/**
 * Acento de una oposición. Una oposición nueva (o una PERSONALIZADA, que no tiene slug)
 * cae en el valor por defecto — que es además el mayoritario.
 */
export function acentoDe(oposicion?: string | null): AcentoTemario {
  if (!oposicion) return ACENTO_POR_DEFECTO
  return EXCEPCIONES[oposicion] ?? ACENTO_POR_DEFECTO
}

export interface ClasesAcento {
  /** píldora «N con preguntas de examen» de la cabecera */
  pildora: string
  /** contador «N con examen» de la cabecera de cada ley */
  contadorLey: string
  /** borde de la tarjeta de un artículo que ha caído en examen */
  bordeArticulo: string
  /** fondo de la cabecera de esa tarjeta */
  fondoCabecera: string
  /** badge «Examen N» de la tarjeta */
  badge: string
}

const CLASES: Record<AcentoTemario, ClasesAcento> = {
  amber: {
    pildora: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
    contadorLey: 'text-amber-600 dark:text-amber-400',
    bordeArticulo: 'border-amber-300 dark:border-amber-600 ring-1 ring-amber-200 dark:ring-amber-700',
    fondoCabecera: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
    badge: 'bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200',
  },
  rose: {
    pildora: 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200',
    contadorLey: 'text-rose-600 dark:text-rose-400',
    bordeArticulo: 'border-rose-300 dark:border-rose-600 ring-1 ring-rose-200 dark:ring-rose-700',
    fondoCabecera: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-700',
    badge: 'bg-rose-100 dark:bg-rose-800/50 text-rose-800 dark:text-rose-200',
  },
  red: {
    pildora: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
    contadorLey: 'text-red-600 dark:text-red-400',
    bordeArticulo: 'border-red-300 dark:border-red-600 ring-1 ring-red-200 dark:ring-red-700',
    fondoCabecera: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
    badge: 'bg-red-100 dark:bg-red-800/50 text-red-800 dark:text-red-200',
  },
}

export function clasesAcento(acento: AcentoTemario): ClasesAcento {
  return CLASES[acento]
}

/** Solo para el guardarraíl/tests: las oposiciones que declaran acento propio. */
export function oposicionesConAcentoPropio(): string[] {
  return Object.keys(EXCEPCIONES)
}
