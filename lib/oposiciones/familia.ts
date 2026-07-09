// lib/oposiciones/familia.ts
//
// FAMILIA / vertical profesional de una oposición — taxonomía CERRADA + clasificador
// PURO (sin BD, sin red) para poder testearlo y correrlo tanto en backfill como en el
// ingest del feed. La familia es lo que separa "de qué va" una convocatoria: un
// opositor de Administración NO debe ver Sanidad aunque compartan subgrupo (C2 mezcla
// auxiliar administrativo + TCAE + celador). El resultado se PERSISTE en
// oposiciones.familia (clasificar en cada render no escala); esta función es la única
// fuente de la clasificación (backfill + ingest la usan; los readers leen la columna).
//
// Diseño anti-chapuza:
//  · Se clasifica por la PROFESIÓN del nombre (multilingüe: es/ca/gl/eu), en orden de
//    prioridad. El ORGANISMO (administracion) solo desempata como FALLBACK cuando el
//    nombre no dice profesión, nunca por encima de la profesión (así "Administrativo/a
//    - Osakidetza" = Administración, no Sanidad).
//  · Palabras del nombre = PROFESIÓN, nunca el empleador embebido ("... de Salud") →
//    'salud' NO es keyword de sanidad (sí 'enfermer', 'sanitari'…). El empleador se
//    mira aparte, sobre la columna administracion.
//  · 'facultativo' es AMBIGUO ("Facultativo Especialista de Área"=médico vs "Cuerpo
//    Superior Facultativo, opción Química"=técnico) → NO se usa suelto; solo la frase
//    'facultativo especialista' / 'especialista de area' (marca del FEA médico).

export const FAMILIAS = {
  administracion_general: 'Administración',
  sanidad: 'Sanidad',
  educacion: 'Educación',
  justicia: 'Justicia',
  seguridad: 'Seguridad y emergencias',
  tecnica: 'Técnica e ingeniería',
  social: 'Social',
  oficios: 'Oficios y servicios',
  otros: 'Otros',
} as const

export type Familia = keyof typeof FAMILIAS
export const FAMILIA_KEYS = Object.keys(FAMILIAS) as Familia[]

/**
 * minúsculas + sin diacríticos → 'enfermería'==='enfermeria' (es/ca/gl/eu). Además:
 *  · quita el marcador de género '/a', '/o', '/as'… ('Trabajador/a Social' →
 *    'trabajador social', si no las keywords de 2+ palabras nunca casarían),
 *  · convierte separadores (guiones, paréntesis, comas) en espacios para buscar por
 *    substring de forma fiable.
 */
export function normalizeFamiliaText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\/[a-z]{1,4}\b/g, '') // género: enfermero/a, trabajador/a, tecnico/as
    .replace(/[^a-z0-9\s]/g, ' ') // separadores → espacio
    .replace(/\s+/g, ' ')
    .trim()
}

// Reglas por PROFESIÓN, en ORDEN de prioridad (la primera que casa gana). Claves
// normalizadas (sin acentos). Incluye variantes es/ca/gl/eu.
const PROFESION_RULES: { familia: Familia; kws: string[] }[] = [
  {
    familia: 'justicia',
    kws: [
      'procesal', 'processal', 'judicial', 'forense', 'auxilio judicial',
      'auxili judicial', 'gestion procesal', 'tramitacion procesal', 'ministerio fiscal',
      'administracion de justicia', 'administracio de justicia', 'letrado', 'lletrat',
    ],
  },
  {
    familia: 'seguridad',
    kws: [
      'guardia civil', 'guardia urbana', 'guardia municipal', 'guardia local',
      'policia', 'bombero', 'bomber', 'bombeiro', 'mosso', 'ertzain',
      'penitenciari', 'prisiones', 'presons', 'militar', 'ejercito', 'exercit',
      'agente rural', 'agent rural', 'agents rurals', 'vigilancia aduanera',
      'proteccion civil', 'seguridad ciudadana', 'agente de policia',
    ],
  },
  {
    familia: 'sanidad',
    kws: [
      'enfermer', 'infermer', 'matron', 'llevadora', 'tcae',
      'cuidados auxiliares de enfermeria', 'cures auxiliars', 'celador', 'medic',
      'metge', 'sanitari', 'farmac', 'odontolog', 'veterinari', 'fisioterap',
      'logoped', 'podolog', 'optic', 'optometr', 'radiodiagnostic',
      'anatomia patologica', 'dietetic', 'nutricion', 'higienista', 'pediatr',
      'anestesi', 'nefrolog', 'cirug', 'cirurgi', 'psiquiatr', 'ginecolog',
      'radiolog', 'hematolog', 'oncolog', 'cardiolog', 'dermatolog', 'traumatolog',
      'rehabilitacion', 'salud publica', 'salut publica', 'terapeuta ocupacional',
      'tecnico superior sanitario', 'tecnic superior sanitari', 'auxiliar de farmacia',
      'atencion primaria', 'atencio primaria',
      // FEA médico (facultativo NO suelto; solo la frase especialista):
      'facultativo especialista', 'facultatiu especialista', 'facultativa especialista',
      'especialista de area', 'especialista d area',
    ],
  },
  {
    familia: 'educacion',
    kws: [
      'profesor', 'professor', 'maestr', 'mestre', 'catedratic',
      'ensenanza secundaria', 'ensenyament', 'educacion secundaria',
      'educacion infantil', 'educacion primaria', 'educacion fisica',
      'artes plasticas', 'arts plastiques', 'conservatorio', 'conservatori',
      'inspector de educacion', 'formacion profesional', 'docencia', 'docent',
    ],
  },
  {
    familia: 'social',
    kws: [
      'trabajador social', 'trabajo social', 'treballador social', 'treball social',
      'educador', 'sociolog', 'psicolog', 'psicopedagog', 'mediador',
      'integrador social', 'animador sociocultural', 'tecnico de integracion',
      'agente de igualdad', 'agent d igualtat',
    ],
  },
  {
    familia: 'tecnica',
    kws: [
      'ingenier', 'enginy', 'arquitect', 'aparejador', 'delineac', 'delinea',
      'informatic', 'telecomunicac', 'programador', 'analista', 'quimic', 'geolog',
      'minas', 'obras publicas', 'obres publiques', 'industrial', 'agronom',
      'forestal', 'cartograf', 'topograf', 'estadistic', 'actuari', 'biolog',
      'tecnico de sistemas', 'tecnic de sistemes', 'laboratorio', 'laboratori',
      'medio ambiente', 'medi ambient', 'medio natural', 'medi natural',
      'agente forestal', 'agent forestal', 'medioambiental', 'agente medioambiental',
      'cientific', 'instrumentacion', 'investigacion', 'enolog', 'escala tecnica',
      'escala mitjana', 'instrumentacio',
    ],
  },
  {
    familia: 'administracion_general',
    kws: [
      'administrativ', 'administratiu', 'gestion', 'gestio', 'tramitacion',
      'tramitacio', 'gestor', 'tributari', 'hacienda', 'tesoreria', 'tresoreria',
      'intervencion', 'interventor', 'recaudacion', 'aeat', 'agencia tributaria',
      'campana de la renta', 'catastro', 'catastr',
      'tecnico de administracion general', 'tecnic administracio general',
      'secretario', 'secretari', 'archiv', 'arxiv', 'bibliotec',
      'cos auxiliar de l', 'cos administratiu', 'cos de gestio',
      'administracion general', 'administracio general', 'administracion especial',
      'auxiliar de la administracion', 'administracion de la comunidad',
      'subinspector laboral', 'subinspectores laborales', 'inspeccion de trabajo',
      'inspector de trabajo', 'cuerpo auxiliar de la administracion', 'cuerpo auxiliar',
      'cos auxiliar', 'cos de gestio', 'cos de diplomatura', 'cos superior',
      'desarrollo local', 'agente de desarrollo',
    ],
  },
  {
    familia: 'oficios',
    kws: [
      'fontaner', 'electricist', 'conductor', 'chofer', 'peon', 'servicios generales',
      'serveis generals', 'subalterno', 'subaltern', 'ordenanza', 'ujier', 'limpieza',
      'neteja', 'cocina', 'cociner', 'jardiner', 'mantenimiento', 'manteniment',
      'mecanic', 'carpinter', 'pinche', 'camarer', 'telefonista', 'notificador',
      'operario', 'operador', 'vigilante', 'portero', 'albanil', 'pintor', 'soldador',
      'almacen', 'magatzem', 'auxiliar de servicios', 'personal de oficios',
    ],
  },
]

// FALLBACK por EMPLEADOR (columna administracion) — solo si el nombre no dio profesión.
const EMPLEADOR_RULES: { familia: Familia; kws: string[] }[] = [
  {
    familia: 'sanidad',
    kws: [
      'salud', 'salut', 'saude', 'osasunbidea', 'osakidetza', 'sergas', 'sescam',
      'sacyl', 'sespa', 'ib salut', 'ibsalut',
    ],
  },
  {
    familia: 'educacion',
    kws: ['educacion', 'educacio', 'ensenyament', 'ensenanza'],
  },
]

/**
 * Clasifica la familia de una convocatoria. `nombre` = puesto/cuerpo (señal
 * principal); `administracion` = organismo convocante (desempate). Devuelve 'otros'
 * si nada casa (el backfill informa del residuo para iterar; nunca se deja crecer).
 */
export function classifyFamilia(
  nombre: string | null | undefined,
  administracion?: string | null,
): Familia {
  const n = normalizeFamiliaText(nombre ?? '')
  if (n) {
    for (const rule of PROFESION_RULES) {
      if (rule.kws.some((k) => n.includes(k))) return rule.familia
    }
  }
  const a = normalizeFamiliaText(administracion ?? '')
  if (a) {
    for (const rule of EMPLEADOR_RULES) {
      if (rule.kws.some((k) => a.includes(k))) return rule.familia
    }
  }
  return 'otros'
}

export function familiaLabel(f: string | null | undefined): string {
  return f && f in FAMILIAS ? FAMILIAS[f as Familia] : FAMILIAS.otros
}
