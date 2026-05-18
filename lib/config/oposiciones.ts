// lib/config/oposiciones.ts - Fuente de verdad centralizada para configuración de oposiciones
// Todos los datos de oposiciones (IDs, slugs, nombres, bloques, temas) deben importarse de aquí.
//
// IMPORTANTE sobre theme.id vs theme.displayNumber:
// - theme.id DEBE coincidir con el topic_number real en la tabla `topics` de la BD.
//   Es lo que usan las APIs para buscar preguntas (topic_scope, filtered-questions, etc.)
// - theme.displayNumber es OPCIONAL. Solo se necesita cuando el topic_number de la BD
//   no coincide con el número que el usuario espera ver en la UI.
//   Ejemplo: administrativo-estado tiene topic_numbers 201-204 en BD (bloque 2),
//   pero el temario oficial los numera como Temas 12-15 (secuencial).
//   Sin displayNumber, la UI mostraría "T201" en vez de "T12".
// - Si no se pone displayNumber, la UI muestra theme.id directamente.
//   Esto funciona bien cuando los IDs ya son user-friendly (ej: 1-37, 1-16, 101-112).
import { z } from 'zod'

// ============================================
// ZOD SCHEMAS
// ============================================

const ThemeSchema = z.object({
  id: z.number(),          // topic_number en BD (usado por las APIs)
  name: z.string(),
  displayNumber: z.number().optional(), // número visible al usuario (si difiere del id)
})

const BlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  icon: z.string(),
  themes: z.array(ThemeSchema),
})

const OfficialExamBreakdownItemSchema = z.object({
  label: z.string(),
  count: z.number().int().nonnegative(),
})

const OfficialExamParteSchema = z
  .object({
    id: z.string(),
    icon: z.string(),
    title: z.string(),

    // Campos estructurados (opcionales). Cuando se rellenan, son fuente de
    // verdad y el helper formatParteDescription genera el string al usuario.
    // El test de coherencia (__tests__/config/officialExamsCoherence.test.ts)
    // exige que la suma cuadre con las questions reales en BD.
    ordinaryCount: z.number().int().nonnegative().optional(),
    reserveCount: z.number().int().nonnegative().optional(),
    durationMin: z.number().int().positive().optional(),
    // breakdown libre: cada oposición rellena lo que tenga sentido
    // ("psicotécnicas", "Bloque I", "supuesto práctico"…). No se fuerza patrón.
    breakdown: z.array(OfficialExamBreakdownItemSchema).optional(),
    // Texto libre no-numérico para matices ("(1 anulada en plantilla)"…).
    notes: z.string().optional(),

    // DEPRECATED: solo para entries legacy aún sin migrar. Las nuevas
    // convocatorias deben usar los campos estructurados. Ver el manual
    // docs/maintenance/crear-nueva-oposicion.md.
    description: z.string().optional(),
  })
  .refine((p) => p.description !== undefined || p.ordinaryCount !== undefined, {
    message:
      'OfficialExamParte: cada parte requiere `ordinaryCount` (preferido) o `description` (legacy)',
  })
  .refine(
    (p) =>
      !p.breakdown ||
      p.breakdown.length === 0 ||
      p.breakdown.reduce((s, b) => s + b.count, 0) === (p.ordinaryCount ?? 0),
    {
      message:
        'OfficialExamParte: la suma de `breakdown[].count` debe coincidir con `ordinaryCount`',
    }
  )

const OfficialExamConvocatoriaSchema = z.object({
  date: z.string(),
  title: z.string(),
  oep: z.string(),
  partes: z.array(OfficialExamParteSchema),
  note: z.string().optional(),
  comingSoon: z.boolean().optional(),
})

const NavLinkSchema = z.object({
  href: z.string(),
  label: z.string(),
  icon: z.string(),
  featured: z.boolean().optional(),
})

const OposicionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  positionType: z.string(),
  name: z.string(),
  shortName: z.string(),
  emoji: z.string(),
  badge: z.string(),
  color: z.string(),
  administracion: z.enum(['estado', 'justicia', 'autonomica', 'local', 'empresa_publica']),
  blocks: z.array(BlockSchema),
  totalTopics: z.number(),
  navLinks: z.array(NavLinkSchema),
  officialExams: z.array(OfficialExamConvocatoriaSchema).optional(),
  hasSpellingTest: z.boolean().optional(),
  hasPsychometricTest: z.boolean().optional(),
  questionTag: z.string().optional(), // Si se define, solo se muestran preguntas con este tag (ej: 'PN' para Policía Nacional)
  // Aliases de búsqueda: términos alternativos que los usuarios escriben en
  // los buscadores (Onboarding, Cambio de oposición, Guard de tests). Vive
  // junto al resto del config para que añadir una oposición incluya los
  // aliases en el mismo sitio. Filtrado central en lib/utils/searchOposicion.ts.
  aliases: z.array(z.string()).optional(),
})

// ============================================
// TIPOS DERIVADOS
// ============================================

export type Theme = z.infer<typeof ThemeSchema>
export type Block = z.infer<typeof BlockSchema>
export type NavLink = z.infer<typeof NavLinkSchema>
export type OfficialExamParte = z.infer<typeof OfficialExamParteSchema>
export type OfficialExamConvocatoria = z.infer<typeof OfficialExamConvocatoriaSchema>
export type Oposicion = z.infer<typeof OposicionSchema>

// ============================================
// DATOS: OPOSICIONES
// ============================================

export const OPOSICIONES: Oposicion[] = [
  // ========================================
  // AUXILIAR ADMINISTRATIVO DEL ESTADO (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_estado',
    slug: 'auxiliar-administrativo-estado',
    positionType: 'auxiliar_administrativo_estado',
    name: 'Auxiliar Administrativo del Estado',
    shortName: 'Auxiliar Admin.',
    emoji: '👤',
    badge: 'C2',
    color: 'emerald',
    administracion: 'estado',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Organización Pública',
        subtitle: 'Derecho Constitucional y Administrativo',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'El Tribunal Constitucional. La reforma de la Constitución. La Corona' },
          { id: 3, name: 'Las Cortes Generales' },
          { id: 4, name: 'El Poder Judicial' },
          { id: 5, name: 'El Gobierno y la Administración' },
          { id: 6, name: 'El Gobierno Abierto y la Agenda 2030' },
          { id: 7, name: 'Ley 19/2013 de Transparencia, Acceso a la Información Pública y Buen Gobierno' },
          { id: 8, name: 'La Administración General del Estado' },
          { id: 9, name: 'La Organización territorial del Estado' },
          { id: 10, name: 'La organización de la Unión Europea' },
          { id: 11, name: 'Las Leyes del Procedimiento Administrativo Común y del Régimen Jurídico del Sector Público' },
          { id: 12, name: 'La protección de datos personales y su régimen jurídico: principios, derechos y obligaciones' },
          { id: 13, name: 'El personal funcionario al servicio de las Administraciones públicas' },
          { id: 14, name: 'Derechos y deberes de los funcionarios. La carrera administrativa. Promoción interna. El sistema de retribuciones e indemnizaciones. Régimen disciplinario. El régimen de la Seguridad Social de los funcionarios.' },
          { id: 15, name: 'El presupuesto del Estado en España' },
          { id: 16, name: 'Políticas de igualdad y contra la violencia de género. Políticas de igualdad de trato y no discriminación de las personas LGTBI. Discapacidad y dependencia: régimen jurídico.' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Actividad Administrativa',
        subtitle: 'Informática y Atención al Ciudadano',
        icon: '💻',
        themes: [
          { id: 101, name: 'Atención al ciudadano', displayNumber: 1 },
          { id: 102, name: 'Servicios de información administrativa', displayNumber: 2 },
          { id: 103, name: 'Documento, registro y archivo', displayNumber: 3 },
          { id: 104, name: 'Administración electrónica', displayNumber: 4 },
          { id: 105, name: 'Informática básica', displayNumber: 5 },
          { id: 106, name: 'Sistema operativo Windows 11', displayNumber: 6 },
          { id: 107, name: 'Explorador de Windows 11', displayNumber: 7 },
          { id: 108, name: 'Word', displayNumber: 8 },
          { id: 109, name: 'Excel', displayNumber: 9 },
          { id: 110, name: 'Access', displayNumber: 10 },
          { id: 111, name: 'Correo electrónico', displayNumber: 11 },
          { id: 112, name: 'Internet', displayNumber: 12 },
        ],
      },
    ],
    totalTopics: 28,
    aliases: ['age', 'administracion general', 'gobierno', 'estado', 'c2 estado', 'auxiliar estado', 'admin estado', 'oposicion estado', 'funcionario'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-estado', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-estado/test', label: 'Tests', icon: '🎯' },
      { href: '/auxiliar-administrativo-estado/simulacros', label: 'Simulacros', icon: '🏆' },
    ],
    officialExams: [
      {
        date: '2024-07-09',
        title: 'Convocatoria 9 de julio de 2024',
        oep: 'OEP 2023-2024',
        partes: [
          { id: 'primera', icon: '📘', title: 'Primera parte', description: 'Bloque I: Organización del Estado (64 preguntas)' },
          { id: 'segunda', icon: '📗', title: 'Segunda parte', description: 'Bloque II: Actividad Administrativa y Ofimática (55 preguntas)' },
        ],
        note: '📊 Nota de corte: 1ª parte: 5,31/10 | 2ª parte: 5,0/10',
      },
      {
        date: '2023-01-20',
        title: 'Convocatoria 20 de enero de 2023',
        oep: 'OEP 2021-2022',
        partes: [
          { id: 'primera', icon: '📘', title: 'Primera parte', description: '31 legislativas + 32 psicotécnicas (63 preguntas)' },
          { id: 'segunda', icon: '📗', title: 'Segunda parte', description: 'Actividad administrativa y Ofimática (50 preguntas)' },
        ],
      },
      {
        date: '2021-05-26',
        title: 'Convocatoria 26 de mayo de 2021',
        oep: 'OEP 2020',
        partes: [
          { id: 'primera', icon: '📘', title: 'Primera parte', description: 'Legislativas + Psicotécnicas (62 preguntas)' },
          { id: 'segunda', icon: '📗', title: 'Segunda parte', description: 'Bloque II: Actividad Administrativa y Ofimática (53 preguntas)' },
        ],
        note: 'ℹ️ Nota: Preguntas de informática actualizadas a Office 365 y Windows 11',
      },
      {
        date: '2019-06-14',
        title: 'Convocatoria 14 de junio de 2019',
        oep: 'OEP 2018-2019',
        partes: [
          { id: 'primera', icon: '📘', title: 'Primera parte', description: 'Legislativas + Psicotécnicas (64 preguntas)' },
          { id: 'segunda', icon: '📗', title: 'Segunda parte', description: 'Bloque II: Actividad Administrativa y Ofimática (34 preguntas)' },
        ],
        note: 'ℹ️ Nota: Preguntas de informática actualizadas a Office 365 y Windows 11',
      },
    ],
  },

  // ========================================
  // ADMINISTRATIVO DEL ESTADO (C1)
  // ========================================
  {
    id: 'administrativo_estado',
    slug: 'administrativo-estado',
    positionType: 'administrativo_estado',
    name: 'Administrativo del Estado',
    shortName: 'Admin. Estado',
    emoji: '👨‍💼',
    badge: 'C1',
    color: 'blue',
    administracion: 'estado',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Organización del Estado',
        subtitle: 'Constitución, Gobierno, Administración',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'La Jefatura del Estado. La Corona' },
          { id: 3, name: 'Las Cortes Generales' },
          { id: 4, name: 'El Poder Judicial' },
          { id: 5, name: 'El Gobierno y la Administración' },
          { id: 6, name: 'El Gobierno Abierto. Agenda 2030' },
          { id: 7, name: 'La Ley 19/2013 de Transparencia' },
          { id: 8, name: 'La Administración General del Estado' },
          { id: 9, name: 'La Organización Territorial del Estado' },
          { id: 10, name: 'La Administración Local' },
          { id: 11, name: 'La Organización de la Unión Europea' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Organización de Oficinas Públicas',
        subtitle: 'Atención ciudadana, Registros, Archivos',
        icon: '📋',
        themes: [
          { id: 201, name: 'Atención al Público', displayNumber: 12 },
          { id: 202, name: 'Documento, Registro y Archivo', displayNumber: 13 },
          { id: 203, name: 'Administración Electrónica', displayNumber: 14 },
          { id: 204, name: 'Protección de Datos Personales', displayNumber: 15 },
        ],
      },
      {
        id: 'bloque3',
        title: 'Bloque III: Derecho Administrativo General',
        subtitle: 'Procedimiento, Contratos, Responsabilidad',
        icon: '⚖️',
        themes: [
          { id: 301, name: 'Las Fuentes del Derecho Administrativo', displayNumber: 16 },
          { id: 302, name: 'El Acto Administrativo', displayNumber: 17 },
          { id: 303, name: 'Las Leyes del Procedimiento Administrativo', displayNumber: 18 },
          { id: 304, name: 'Los Contratos del Sector Público', displayNumber: 19 },
          { id: 305, name: 'Procedimientos y Formas de la Actividad Administrativa', displayNumber: 20 },
          { id: 306, name: 'La Responsabilidad Patrimonial', displayNumber: 21 },
          { id: 307, name: 'Políticas de Igualdad', displayNumber: 22 },
        ],
      },
      {
        id: 'bloque4',
        title: 'Bloque IV: Gestión de Personal',
        subtitle: 'Empleo público, Derechos, Deberes',
        icon: '👥',
        themes: [
          { id: 401, name: 'El Personal al Servicio de las Administraciones Públicas', displayNumber: 23 },
          { id: 402, name: 'Selección de Personal', displayNumber: 24 },
          { id: 403, name: 'El Personal Funcionario', displayNumber: 25 },
          { id: 404, name: 'Adquisición y Pérdida de la Condición de Funcionario', displayNumber: 26 },
          { id: 405, name: 'Provisión de Puestos de Trabajo', displayNumber: 27 },
          { id: 406, name: 'Las Incompatibilidades y Régimen Disciplinario', displayNumber: 28 },
          { id: 407, name: 'El Régimen de la Seguridad Social de los Funcionarios', displayNumber: 29 },
          { id: 408, name: 'El Personal Laboral', displayNumber: 30 },
          { id: 409, name: 'El Régimen de la Seguridad Social del Personal Laboral', displayNumber: 31 },
        ],
      },
      {
        id: 'bloque5',
        title: 'Bloque V: Gestión Financiera',
        subtitle: 'Presupuestos, Gastos, Retribuciones',
        icon: '💰',
        themes: [
          { id: 501, name: 'El Presupuesto', displayNumber: 32 },
          { id: 502, name: 'El Presupuesto del Estado en España', displayNumber: 33 },
          { id: 503, name: 'El Procedimiento de Ejecución del Presupuesto de Gasto', displayNumber: 34 },
          { id: 504, name: 'Las Retribuciones e Indemnizaciones', displayNumber: 35 },
          { id: 505, name: 'Gastos para la Compra de Bienes y Servicios', displayNumber: 36 },
          { id: 506, name: 'Gestión Económica y Financiera', displayNumber: 37 },
        ],
      },
      {
        id: 'bloque6',
        title: 'Bloque VI: Informática Básica y Ofimática',
        subtitle: 'Windows, Office, Internet',
        icon: '💻',
        themes: [
          { id: 601, name: 'Informática Básica', displayNumber: 38 },
          { id: 602, name: 'Sistema Operativo Windows', displayNumber: 39 },
          { id: 603, name: 'El Explorador de Windows', displayNumber: 40 },
          { id: 604, name: 'Procesadores de Texto: Word 365', displayNumber: 41 },
          { id: 605, name: 'Hojas de Cálculo: Excel 365', displayNumber: 42 },
          { id: 606, name: 'Bases de Datos: Access 365', displayNumber: 43 },
          { id: 607, name: 'Correo Electrónico: Outlook 365', displayNumber: 44 },
          { id: 608, name: 'La Red Internet', displayNumber: 45 },
        ],
      },
    ],
    totalTopics: 45,
    aliases: ['c1 estado', 'administrativo general', 'administrativo del estado', 'c1', 'grupo c1'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/administrativo-estado', label: 'Mi Oposición', icon: '🏢', featured: true },
      { href: '/administrativo-estado/temario', label: 'Temario', icon: '📚' },
      { href: '/administrativo-estado/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // TRAMITACIÓN PROCESAL (C1)
  // ========================================
  {
    id: 'tramitacion_procesal',
    slug: 'tramitacion-procesal',
    positionType: 'tramitacion_procesal',
    name: 'Tramitación Procesal y Administrativa',
    shortName: 'Tramitación Proc.',
    emoji: '⚖️',
    badge: 'C1',
    color: 'purple',
    administracion: 'justicia',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Organización del Estado y Administración de Justicia',
        subtitle: 'Constitución, Poder Judicial y Funcionarios',
        icon: '⚖️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Igualdad y no discriminación por razón de género' },
          { id: 3, name: 'El Gobierno y la Administración' },
          { id: 4, name: 'Organización territorial del Estado' },
          { id: 5, name: 'La Unión Europea' },
          { id: 6, name: 'El Poder Judicial' },
          { id: 7, name: 'Organización y competencia de los órganos judiciales (I)' },
          { id: 8, name: 'Organización y competencia de los órganos judiciales (II)' },
          { id: 9, name: 'Carta de Derechos de los Ciudadanos ante la Justicia' },
          { id: 10, name: 'La modernización de la oficina judicial' },
          { id: 11, name: 'El Letrado de la Administración de Justicia' },
          { id: 12, name: 'Los Cuerpos de funcionarios al servicio de la Administración de Justicia' },
          { id: 13, name: 'Ingreso y promoción en los Cuerpos Generales' },
          { id: 14, name: 'Situaciones administrativas de los funcionarios' },
          { id: 15, name: 'Libertad sindical' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Derecho Procesal',
        subtitle: 'Procedimientos civiles, penales y administrativos',
        icon: '📜',
        themes: [
          { id: 16, name: 'Los procedimientos declarativos en la LEC' },
          { id: 17, name: 'Los procedimientos de ejecución en la LEC' },
          { id: 18, name: 'Los procesos especiales en la LEC' },
          { id: 19, name: 'La jurisdicción voluntaria' },
          { id: 20, name: 'Los procedimientos penales en la LECrim (I)' },
          { id: 21, name: 'Los procedimientos penales en la LECrim (II)' },
          { id: 22, name: 'El recurso contencioso-administrativo' },
          { id: 23, name: 'El proceso laboral' },
          { id: 24, name: 'Los recursos' },
          { id: 25, name: 'Los actos procesales' },
          { id: 26, name: 'Las resoluciones de los órganos judiciales' },
          { id: 27, name: 'Los actos de comunicación con otros tribunales y autoridades' },
          { id: 28, name: 'Los actos de comunicación a las partes' },
          { id: 29, name: 'El Registro Civil (I)' },
          { id: 30, name: 'El Registro Civil (II)' },
          { id: 31, name: 'El archivo judicial y la documentación' },
        ],
      },
      {
        id: 'bloque3',
        title: 'Bloque III: Informática',
        subtitle: 'Ofimática y tecnología',
        icon: '💻',
        themes: [
          { id: 32, name: 'Informática básica' },
          { id: 33, name: 'Introducción al sistema operativo Windows' },
          { id: 34, name: 'El explorador de Windows' },
          { id: 35, name: 'Procesadores de texto: Word 365' },
          { id: 36, name: 'Correo electrónico: Outlook 365' },
          { id: 37, name: 'La Red Internet' },
        ],
      },
    ],
    totalTopics: 37,
    aliases: ['tramitacion', 'procesal', 'justicia', 'tramitacion procesal', 'turno libre justicia', 'ministerio justicia'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/tramitacion-procesal', label: 'Mi Oposición', icon: '⚖️', featured: true },
      { href: '/tramitacion-procesal/temario', label: 'Temario', icon: '📚' },
      { href: '/tramitacion-procesal/test', label: 'Tests', icon: '🎯' },
    ],
    officialExams: [
      {
        date: '2025-09-27',
        title: 'Convocatoria 27 de septiembre de 2025',
        oep: 'OEP 2024',
        partes: [
          { id: 'unica', icon: '📘', title: 'Primer ejercicio', description: 'Test legislativo (100 preguntas)' },
          { id: 'supuesto', icon: '📙', title: 'Segundo ejercicio', description: 'Supuesto práctico (9 preguntas)' },
          { id: 'tercer-ejercicio', icon: '📗', title: 'Tercer ejercicio', description: 'Informática (19 preguntas)' },
        ],
      },
      {
        date: '2024-09-28',
        title: 'Convocatoria 28 de septiembre de 2024',
        oep: 'OEP 2023',
        partes: [
          { id: 'unica', icon: '📘', title: 'Examen completo', description: 'Primer ejercicio (100 preguntas)' },
        ],
      },
      {
        date: '2024-03-02',
        title: 'Convocatoria 2 de marzo de 2024 (Estabilización)',
        oep: 'OEP 2021',
        partes: [
          { id: 'unica', icon: '📘', title: 'Examen completo', description: 'Primer ejercicio (100 preguntas)' },
        ],
      },
      {
        date: '2023-01-01',
        title: 'Convocatoria 2023',
        oep: 'OEP 2020-2022',
        partes: [
          { id: 'unica', icon: '📘', title: 'Examen completo', description: 'Primer ejercicio (100 preguntas)' },
        ],
      },
      {
        date: '2020-01-01',
        title: 'Convocatoria 2020',
        oep: 'OEP 2017-2018',
        partes: [
          { id: 'unica', icon: '📘', title: 'Examen completo', description: 'Primer ejercicio (100 preguntas)' },
        ],
      },
      {
        date: '2018-05-12',
        title: 'Convocatoria 12 de mayo de 2018',
        oep: 'OEP 2016',
        partes: [
          { id: 'unica', icon: '📘', title: 'Examen completo', description: 'Primer ejercicio (100 preguntas)' },
        ],
      },
      {
        date: '2016-07-03',
        title: 'Convocatoria 3 de julio de 2016',
        oep: 'OEP 2015',
        partes: [
          { id: 'unica', icon: '📘', title: 'Examen completo', description: 'Primer ejercicio (100 preguntas)' },
        ],
      },
      {
        date: '2012-03-11',
        title: 'Convocatoria 11 de marzo de 2012',
        oep: 'OEP 2011',
        partes: [
          { id: 'unica', icon: '📘', title: 'Examen completo', description: 'Primer ejercicio (100 preguntas)' },
        ],
      },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO CARM (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_carm',
    slug: 'auxiliar-administrativo-carm',
    positionType: 'auxiliar_administrativo_carm',
    name: 'Auxiliar Administrativo CARM (Murcia)',
    shortName: 'Aux. CARM',
    emoji: '🏛️',
    badge: 'C2',
    color: 'amber',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Derecho Constitucional y Administrativo',
        subtitle: null,
        icon: '⚖️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Estatuto de Autonomía de la Región de Murcia' },
          { id: 3, name: 'El Presidente y Consejo de Gobierno de Murcia' },
          { id: 4, name: 'Régimen Jurídico del Sector Público' },
          { id: 5, name: 'Disposiciones y actos administrativos' },
          { id: 6, name: 'El procedimiento administrativo' },
          { id: 7, name: 'Revisión de actos en vía administrativa' },
          { id: 8, name: 'Estatuto Básico del Empleado Público' },
          { id: 9, name: 'Contratos del Sector Público' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Gestión y Administración Pública',
        subtitle: null,
        icon: '📋',
        themes: [
          { id: 10, name: 'Hacienda de la Región de Murcia' },
          { id: 11, name: 'Administración electrónica' },
          { id: 12, name: 'Información administrativa y atención al ciudadano' },
          { id: 13, name: 'Archivos y Patrimonio Documental de Murcia' },
          { id: 14, name: 'Los documentos administrativos' },
          { id: 15, name: 'Prevención de Riesgos Laborales' },
          { id: 16, name: 'Igualdad, Transparencia y Protección de datos' },
        ],
      },
      {
        id: 'segunda_parte',
        title: 'Segunda parte: Herramientas informáticas',
        subtitle: null,
        icon: '💻',
        themes: [
          { id: 17, name: 'Presentaciones con PowerPoint 2016' },
          { id: 18, name: 'Hoja de cálculo Excel 2016' },
          { id: 19, name: 'Firma electrónica y certificados digitales' },
          { id: 20, name: 'Procesador de textos Word 2016' },
          { id: 21, name: 'Outlook 365' },
        ],
      },
    ],
    totalTopics: 21,
    aliases: ['murcia', 'region de murcia', 'auxiliar murcia', 'admin murcia', 'c2 murcia', 'carm', 'comunidad autonoma murcia'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-carm', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-carm/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-carm/test', label: 'Tests', icon: '🎯' },
    ],
    officialExams: [
      {
        date: '2020-02-23',
        title: 'Convocatoria DGX00C18 (consolidación)',
        oep: 'OEP 2017',
        partes: [
          { id: 'primera', icon: '📘', title: 'Ejercicio único', description: '74 preguntas test (incluye supuestos prácticos)' },
        ],
        note: '41 plazas — proceso de consolidación de empleo temporal.',
      },
      {
        date: '2023-10-01',
        title: 'Convocatoria DGX00C22 (estabilización)',
        oep: 'OEP 2021',
        partes: [
          { id: 'primera', icon: '📘', title: 'Ejercicio único', description: '74 preguntas test (1 anulada en plantilla oficial)' },
        ],
        note: '111 plazas — estabilización Ley 20/2021.',
      },
      {
        date: '2024-10-06',
        title: 'Convocatoria DGX00L19 ej.1 (turno libre)',
        oep: 'OEP 2018-2019',
        partes: [
          { id: 'primera', icon: '📘', title: 'Primer ejercicio', description: '75 preguntas test (incluye 2 supuestos prácticos)' },
        ],
        note: '10 plazas — turno libre. Pendiente importar 2º ejercicio.',
      },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO DIPUTACIÓN DE ZARAGOZA (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_diputacion_zaragoza',
    slug: 'auxiliar-administrativo-diputacion-zaragoza',
    positionType: 'auxiliar_administrativo_diputacion_zaragoza',
    name: 'Auxiliar Administrativo Diputación Provincial de Zaragoza',
    shortName: 'Aux. Dip. Zaragoza',
    emoji: '🏛️',
    badge: 'C2',
    color: 'amber',
    administracion: 'local',
    blocks: [
      {
        id: 'comunes',
        title: 'Materias Comunes',
        subtitle: null,
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Organización territorial del Estado' },
          { id: 3, name: 'Derecho Administrativo' },
          { id: 4, name: 'Régimen local español' },
        ],
      },
      {
        id: 'especificas',
        title: 'Materias Específicas',
        subtitle: null,
        icon: '⚖️',
        themes: [
          { id: 5, name: 'El expediente administrativo' },
          { id: 6, name: 'El Procedimiento Administrativo Común' },
          { id: 7, name: 'El acto administrativo' },
          { id: 8, name: 'Revisión de actos y recursos' },
          { id: 9, name: 'La provincia y el municipio' },
          { id: 10, name: 'Ordenanzas y reglamentos locales' },
          { id: 11, name: 'La contratación pública' },
          { id: 12, name: 'Formas de acción administrativa' },
          { id: 13, name: 'Los bienes de las Entidades locales' },
          { id: 14, name: 'Haciendas Locales' },
          { id: 15, name: 'Subvenciones' },
          { id: 16, name: 'El personal al servicio de las AAPP' },
          { id: 17, name: 'Los presupuestos locales' },
          { id: 18, name: 'Transparencia, protección de datos e igualdad' },
          { id: 19, name: 'Administración electrónica e informática' },
          { id: 20, name: 'Prevención de Riesgos Laborales' },
        ],
      },
    ],
    totalTopics: 20,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-diputacion-zaragoza', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-diputacion-zaragoza/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-diputacion-zaragoza/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO DIPUTACIÓN DE CÁDIZ (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_diputacion_cadiz',
    slug: 'auxiliar-administrativo-diputacion-cadiz',
    positionType: 'auxiliar_administrativo_diputacion_cadiz',
    name: 'Auxiliar Administrativo de la Diputación Provincial de Cádiz',
    shortName: 'Aux. Dip. Cádiz',
    emoji: '🏛️',
    badge: 'C2',
    color: 'amber',
    administracion: 'local',
    blocks: [
      {
        id: 'comunes',
        title: 'Bloque I: Materias Comunes',
        subtitle: null,
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'La Corona y los poderes del Estado' },
          { id: 3, name: 'La Administración Pública en el ordenamiento jurídico español' },
          { id: 4, name: 'El Estatuto de Autonomía para Andalucía' },
          { id: 5, name: 'El Régimen Local Español' },
          { id: 6, name: 'La Provincia' },
          { id: 7, name: 'El Municipio' },
          { id: 8, name: 'Los derechos de los ciudadanos ante la Administración Pública' },
          { id: 9, name: 'Ley de Prevención de Riesgos Laborales' },
          { id: 10, name: 'Igualdad de oportunidades y no discriminación' },
        ],
      },
      {
        id: 'especificas',
        title: 'Bloque II: Materias Específicas',
        subtitle: null,
        icon: '⚖️',
        themes: [
          { id: 11, name: 'El personal al servicio de las Administraciones Públicas' },
          { id: 12, name: 'Los funcionarios públicos' },
          { id: 13, name: 'El Procedimiento Administrativo Común' },
          { id: 14, name: 'Fases del procedimiento administrativo' },
          { id: 15, name: 'El acto administrativo' },
          { id: 16, name: 'Recursos administrativos y revisión' },
          { id: 17, name: 'Funcionamiento de los órganos colegiados locales' },
          { id: 18, name: 'Contratos administrativos en la esfera local' },
          { id: 19, name: 'Haciendas locales' },
          { id: 20, name: 'Bienes de las entidades locales' },
          { id: 21, name: 'El interesado y la identificación en el procedimiento electrónico' },
          { id: 22, name: 'El archivo' },
          { id: 23, name: 'Protección de datos personales y derechos digitales' },
          { id: 24, name: 'Sistemas ofimáticos e internet' },
        ],
      },
    ],
    totalTopics: 24,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-diputacion-cadiz', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-diputacion-cadiz/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-diputacion-cadiz/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO DIPUTACIÓN DE LEÓN (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_diputacion_leon',
    slug: 'auxiliar-administrativo-diputacion-leon',
    positionType: 'auxiliar_administrativo_diputacion_leon',
    name: 'Auxiliar Administrativo Diputación Provincial de León',
    shortName: 'Aux. Dip. León',
    emoji: '🏛️',
    badge: 'C2',
    color: 'amber',
    administracion: 'local',
    blocks: [
      {
        id: 'bloque-1',
        title: 'Bloque I: Derecho Constitucional, Autonómico y Comunitario',
        subtitle: null,
        icon: '📜',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Derechos y deberes fundamentales' },
          { id: 3, name: 'Poder legislativo y Gobierno' },
          { id: 4, name: 'Organización territorial del Estado y Estatuto de Autonomía de CyL' },
          { id: 5, name: 'La Unión Europea' },
          { id: 6, name: 'Igualdad y no discriminación en CyL' },
          { id: 7, name: 'Protección de datos y transparencia' },
          { id: 8, name: 'Prevención de Riesgos Laborales' },
        ],
      },
      {
        id: 'bloque-2',
        title: 'Bloque II: Derecho Administrativo General',
        subtitle: null,
        icon: '⚖️',
        themes: [
          { id: 9, name: 'Ley 39/2015: objeto, interesados y actividad' },
          { id: 10, name: 'El acto administrativo' },
          { id: 11, name: 'Validez, invalidez y revisión de los actos administrativos' },
          { id: 12, name: 'El procedimiento administrativo común' },
          { id: 13, name: 'Administración electrónica' },
          { id: 14, name: 'Ley 40/2015 LRJSP' },
          { id: 15, name: 'Contratos del Sector Público I' },
          { id: 16, name: 'Contratos del Sector Público II' },
        ],
      },
      {
        id: 'bloque-3',
        title: 'Bloque III: Administración Local y Función Pública',
        subtitle: null,
        icon: '🏛️',
        themes: [
          { id: 17, name: 'La Administración Local en la Constitución' },
          { id: 18, name: 'La Provincia en el régimen local' },
          { id: 19, name: 'Órganos de gobierno provinciales' },
          { id: 20, name: 'El Municipio' },
          { id: 21, name: 'Órganos colegiados locales' },
          { id: 22, name: 'Ordenanzas y Reglamentos de las Entidades Locales' },
          { id: 23, name: 'Actividad de los Entes Locales y subvenciones' },
          { id: 24, name: 'Personal al servicio de las entidades locales' },
          { id: 25, name: 'Estatuto Básico del Empleado Público' },
        ],
      },
    ],
    totalTopics: 25,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-diputacion-leon', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-diputacion-leon/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-diputacion-leon/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO AYUNTAMIENTO DE MURCIA (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_ayuntamiento_murcia',
    slug: 'auxiliar-administrativo-ayuntamiento-murcia',
    positionType: 'auxiliar_administrativo_ayuntamiento_murcia',
    name: 'Auxiliar Administrativo Ayuntamiento de Murcia',
    shortName: 'Aux. Ayto. Murcia',
    emoji: '🏛️',
    badge: 'C2',
    color: 'red',
    administracion: 'local',
    blocks: [
      {
        id: 'general',
        title: 'Temario General',
        subtitle: null,
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'El procedimiento administrativo común' },
          { id: 3, name: 'El Municipio' },
          { id: 4, name: 'El Ayuntamiento de Murcia' },
        ],
      },
      {
        id: 'especifico',
        title: 'Temario Específico',
        subtitle: null,
        icon: '⚖️',
        themes: [
          { id: 5, name: 'Los contratos del sector público' },
          { id: 6, name: 'Las partes en los contratos del sector público' },
          { id: 7, name: 'Preparación y adjudicación de contratos' },
          { id: 8, name: 'La potestad sancionadora' },
          { id: 9, name: 'La responsabilidad patrimonial' },
          { id: 10, name: 'Personal al servicio de las administraciones locales' },
          { id: 11, name: 'Ley General Tributaria' },
          { id: 12, name: 'El presupuesto de las Entidades Locales' },
          { id: 13, name: 'El Gasto Público' },
          { id: 14, name: 'Las subvenciones' },
          { id: 15, name: 'La transparencia de la actividad pública' },
          { id: 16, name: 'Igualdad y violencia de género' },
          { id: 17, name: 'Prevención de Riesgos Laborales' },
          { id: 18, name: 'Informática básica' },
          { id: 19, name: 'Atención al público' },
          { id: 20, name: 'Gobierno Abierto y protección de datos' },
        ],
      },
    ],
    totalTopics: 20,
    aliases: ['ayuntamiento murcia', 'ayto murcia'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-ayuntamiento-murcia', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-ayuntamiento-murcia/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-ayuntamiento-murcia/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO CASTILLA Y LEÓN (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_cyl',
    slug: 'auxiliar-administrativo-cyl',
    positionType: 'auxiliar_administrativo_cyl',
    name: 'Auxiliar Administrativo de Castilla y León',
    shortName: 'Aux. CyL',
    emoji: '🏛️',
    badge: 'C2',
    color: 'rose',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Grupo I: Organización Política y Administrativa',
        subtitle: 'Constitución, Administración y Derecho Administrativo',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'La Administración General del Estado: regulación y estructura' },
          { id: 3, name: 'La Administración local y organización territorial de CyL' },
          { id: 4, name: 'La Unión Europea. Las instituciones europeas' },
          { id: 5, name: 'El Estatuto de Autonomía de Castilla y León' },
          { id: 6, name: 'Las Cortes de Castilla y León' },
          { id: 7, name: 'Instituciones propias de la Comunidad de Castilla y León' },
          { id: 8, name: 'El Gobierno de la Comunidad de Castilla y León' },
          { id: 9, name: 'La Administración de la Comunidad de Castilla y León' },
          { id: 10, name: 'El sector público de la Comunidad de Castilla y León' },
          { id: 11, name: 'Las fuentes del derecho administrativo' },
          { id: 12, name: 'El acto administrativo. Revisión y recursos administrativos' },
          { id: 13, name: 'El procedimiento administrativo común' },
          { id: 14, name: 'Los órganos de las Administraciones Públicas' },
          { id: 15, name: 'El Estatuto Básico del Empleado Público' },
          { id: 16, name: 'La Ley de la Función Pública de Castilla y León' },
          { id: 17, name: 'El derecho de sindicación y de huelga. Régimen de incompatibilidades' },
          { id: 18, name: 'El presupuesto de la Comunidad de Castilla y León' },
          { id: 19, name: 'Políticas de igualdad y no discriminación en Castilla y León' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Grupo II: Competencias',
        subtitle: 'Atención al público, Informática y Administración Electrónica',
        icon: '📋',
        themes: [
          { id: 20, name: 'Derechos de las personas y atención al público' },
          { id: 21, name: 'Oficinas de asistencia en materia de registros de CyL' },
          { id: 22, name: 'La administración electrónica en CyL' },
          { id: 23, name: 'Transparencia y protección de datos' },
          { id: 24, name: 'El documento y archivo administrativo' },
          { id: 25, name: 'Informática básica y Windows 11' },
          { id: 26, name: 'Word y Excel para Microsoft 365' },
          { id: 27, name: 'Correo electrónico e Internet' },
          { id: 28, name: 'Seguridad y salud en el puesto de trabajo' },
        ],
      },
    ],
    totalTopics: 28,
    aliases: ['castilla y leon', 'junta castilla', 'jcyl', 'cyl', 'castilla leon', 'auxiliar castilla', 'admin castilla', 'sacyl', 'junta cyl'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-cyl', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-cyl/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-cyl/test', label: 'Tests', icon: '🎯' },
    ],
    officialExams: [
      {
        date: '2025-01-01',
        title: 'Examen 2025',
        oep: 'OEP 2021, 2022 y 2023',
        partes: [
          { id: 'completo', icon: '📋', title: 'Examen completo', description: '76 preguntas' },
        ],
      },
      {
        date: '2024-01-01',
        title: 'Examen 2024',
        oep: 'OEP 2019-2020',
        partes: [
          { id: 'completo', icon: '📋', title: 'Examen completo', description: '84 preguntas' },
        ],
      },
      {
        date: '2022-01-01',
        title: 'Examen aplazo 2022',
        oep: 'OEP 2018',
        partes: [
          { id: 'completo', icon: '📋', title: 'Examen completo', description: '87 preguntas' },
        ],
      },
      {
        date: '2021-01-01',
        title: 'Examen 2021',
        oep: 'OEP 2018',
        partes: [
          { id: 'completo', icon: '📋', title: 'Examen completo', description: '85 preguntas' },
        ],
      },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO JUNTA DE ANDALUCÍA (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_andalucia',
    slug: 'auxiliar-administrativo-andalucia',
    positionType: 'auxiliar_administrativo_andalucia',
    name: 'Auxiliar Administrativo Junta de Andalucía',
    shortName: 'Aux. Andalucía',
    emoji: '🏛️',
    badge: 'C2',
    color: 'teal',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Área Jurídico Administrativa General',
        subtitle: 'Constitución, Administración y Derecho Administrativo',
        icon: '⚖️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'La organización territorial del Estado' },
          { id: 3, name: 'El Estatuto de Autonomía para Andalucía' },
          { id: 4, name: 'Organización institucional de la Comunidad Autónoma de Andalucía' },
          { id: 5, name: 'La Administración de la Junta de Andalucía' },
          { id: 6, name: 'El Derecho Administrativo' },
          { id: 7, name: 'El procedimiento administrativo común' },
          { id: 8, name: 'Igualdad de género' },
          { id: 9, name: 'Políticas públicas de igualdad de género en Andalucía' },
          { id: 10, name: 'Los presupuestos de la Comunidad Autónoma de Andalucía' },
          { id: 11, name: 'La función pública en la Administración de la Junta de Andalucía' },
          { id: 12, name: 'El régimen de Seguridad Social del personal al servicio de la Junta de Andalucía' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Organización y Gestión Administrativa',
        subtitle: 'Atención al público, Documentos, Informática y Administración Electrónica',
        icon: '📋',
        themes: [
          { id: 13, name: 'Comunicación y atención al público' },
          { id: 14, name: 'Las relaciones de la ciudadanía con la Junta de Andalucía' },
          { id: 15, name: 'Documentos de la Administración de la Junta de Andalucía' },
          { id: 16, name: 'La gestión de documentos en la Administración de la Junta de Andalucía' },
          { id: 17, name: 'El archivo' },
          { id: 18, name: 'La protección de datos' },
          { id: 19, name: 'La calidad' },
          { id: 20, name: 'Sistemas Informáticos' },
          { id: 21, name: 'Sistemas Ofimáticos' },
          { id: 22, name: 'Redes de Comunicaciones e Internet' },
        ],
      },
    ],
    totalTopics: 22,
    aliases: ['junta andalucia', 'andaluz', 'andalucia', 'auxiliar andalucia', 'admin andalucia', 'c2 andalucia', 'junta de andalucia', 'sevilla', 'malaga', 'cadiz', 'cordoba', 'granada'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-andalucia', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-andalucia/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-andalucia/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO COMUNIDAD DE MADRID (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_madrid',
    slug: 'auxiliar-administrativo-madrid',
    positionType: 'auxiliar_administrativo_madrid',
    name: 'Auxiliar Administrativo Comunidad de Madrid',
    shortName: 'Aux. Madrid',
    emoji: '🏛️',
    badge: 'C2',
    color: 'red',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Organización Política',
        subtitle: 'Constitución, CAM, Administración y Derecho Administrativo',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'El Estatuto de Autonomía de la Comunidad de Madrid' },
          { id: 3, name: 'La Ley de Gobierno y Administración de la Comunidad de Madrid' },
          { id: 4, name: 'Las fuentes del ordenamiento jurídico' },
          { id: 5, name: 'El acto administrativo' },
          { id: 6, name: 'La Ley del Procedimiento Administrativo Común de las Administraciones Públicas' },
          { id: 7, name: 'La Jurisdicción Contencioso-Administrativa' },
          { id: 8, name: 'Transparencia y Protección de Datos' },
          { id: 9, name: 'Los contratos en el Sector Público' },
          { id: 10, name: 'El Texto Refundido de la Ley del Estatuto Básico del Empleado Público' },
          { id: 11, name: 'La Seguridad Social' },
          { id: 12, name: 'Hacienda Pública y Presupuestos de la Comunidad de Madrid' },
          { id: 13, name: 'Igualdad de género y no discriminación' },
          { id: 14, name: 'Información administrativa y Administración electrónica' },
          { id: 15, name: 'Los documentos administrativos' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Ofimática',
        subtitle: 'Windows, Office 365 y herramientas colaborativas',
        icon: '💻',
        themes: [
          { id: 16, name: 'El explorador de Windows' },
          { id: 17, name: 'Procesadores de texto: Word' },
          { id: 18, name: 'Hojas de cálculo: Excel' },
          { id: 19, name: 'Bases de datos: Access y Power BI' },
          { id: 20, name: 'Correo electrónico: Outlook' },
          { id: 21, name: 'Trabajo colaborativo: Microsoft 365' },
        ],
      },
    ],
    totalTopics: 21,
    aliases: ['comunidad de madrid', 'cam', 'madrid', 'auxiliar madrid', 'admin madrid', 'c2 madrid'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-madrid', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-madrid/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-madrid/test', label: 'Tests', icon: '🎯' },
    ],
    officialExams: [
      {
        date: '2018-06-29',
        title: 'Convocatoria 2018',
        oep: 'OEP 2015-2016',
        partes: [
          { id: 'primera', icon: '📘', title: '1ª Sesión', description: '45 preguntas tipo test' },
          { id: 'segunda', icon: '📗', title: '2ª Sesión', description: '45 preguntas tipo test' },
        ],
      },
      {
        date: '2022-09-11',
        title: 'Convocatoria 2022',
        oep: 'OEP 2017-2019',
        partes: [
          { id: 'primera', icon: '📘', title: '1ª Sesión', description: '45 preguntas tipo test' },
          { id: 'segunda', icon: '📗', title: '2ª Sesión', description: '45 preguntas tipo test' },
        ],
      },
      {
        date: '2023-06-24',
        title: 'Convocatoria 2023 - Ordinario',
        oep: 'OEP 2020-2022',
        partes: [
          { id: 'primera', icon: '📘', title: 'Primer ejercicio', description: 'Preguntas legislativas' },
        ],
        note: 'Incluye preguntas psicotécnicas (pendientes de importar)',
      },
      {
        date: '2024-11-23',
        title: 'Convocatoria 2024 - Extraordinario',
        oep: 'OEP 2020-2022',
        partes: [
          { id: 'primera', icon: '📘', title: 'Primer ejercicio', description: 'Preguntas legislativas' },
        ],
        note: 'Incluye preguntas psicotécnicas (pendientes de importar)',
      },
      {
        date: '2026-04-12',
        title: 'Convocatoria 2026 (551 plazas)',
        oep: 'OEP 2023-2024',
        partes: [
          {
            id: 'primera',
            icon: '📘',
            title: 'Primer ejercicio',
            ordinaryCount: 60,
            reserveCount: 5,
            durationMin: 65,
            breakdown: [
              { label: 'psicotécnicas', count: 30 },
              { label: 'Bloque I', count: 30 },
            ],
          },
          {
            id: 'segunda',
            icon: '📗',
            title: 'Segundo ejercicio',
            ordinaryCount: 30,
            reserveCount: 5,
            durationMin: 35,
            breakdown: [{ label: 'Bloque II Ofimática', count: 30 }],
          },
        ],
      },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO GOBIERNO DE CANARIAS (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_canarias',
    slug: 'auxiliar-administrativo-canarias',
    positionType: 'auxiliar_administrativo_canarias',
    name: 'Auxiliar Administrativo Gobierno de Canarias',
    shortName: 'Aux. Canarias',
    emoji: '🏛️',
    badge: 'C2',
    color: 'amber',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Parte General',
        subtitle: 'Constitución, Autonomía, UE, Igualdad, Función Pública',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'La organización territorial del Estado' },
          { id: 3, name: 'El Estatuto de Autonomía de Canarias (I)' },
          { id: 4, name: 'El Estatuto de Autonomía de Canarias (II)' },
          { id: 5, name: 'Las Instituciones Autonómicas de Canarias' },
          { id: 6, name: 'El Gobierno de Canarias' },
          { id: 7, name: 'Las islas y la Comunidad Autónoma de Canarias' },
          { id: 8, name: 'El Presupuesto de la Comunidad Autónoma de Canarias' },
          { id: 9, name: 'La organización de la Unión Europea' },
          { id: 10, name: 'Igualdad efectiva de mujeres y hombres' },
          { id: 11, name: 'Violencia de género y discapacidad' },
          { id: 12, name: 'Actividad de las Administraciones Públicas' },
          { id: 13, name: 'Atención al ciudadano' },
          { id: 14, name: 'La transparencia de la actividad pública' },
          { id: 15, name: 'Protección de datos de carácter personal' },
          { id: 16, name: 'La competencia administrativa' },
          { id: 17, name: 'El personal al servicio de las Administraciones Públicas' },
          { id: 18, name: 'La selección del personal funcionario y laboral' },
          { id: 19, name: 'Las situaciones administrativas' },
          { id: 20, name: 'Derechos y deberes de los empleados públicos' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Parte Práctica',
        subtitle: 'Administración, Procedimiento, Contratos, Ofimática',
        icon: '📋',
        themes: [
          { id: 21, name: 'La organización general de la Administración Pública de Canarias' },
          { id: 22, name: 'El acceso electrónico de los ciudadanos a los servicios públicos' },
          { id: 23, name: 'El acto administrativo' },
          { id: 24, name: 'Validez e invalidez de los actos' },
          { id: 25, name: 'Eficacia, notificación y publicación' },
          { id: 26, name: 'La revisión de oficio' },
          { id: 27, name: 'El procedimiento administrativo' },
          { id: 28, name: 'Fases del procedimiento administrativo' },
          { id: 29, name: 'Los recursos administrativos' },
          { id: 30, name: 'Los recursos ordinarios' },
          { id: 31, name: 'Contratación pública (I)' },
          { id: 32, name: 'Contratación pública (II)' },
          { id: 33, name: 'Contratación pública (III)' },
          { id: 34, name: 'Régimen general de ayudas y subvenciones' },
          { id: 35, name: 'Funcionamiento electrónico del sector público' },
          { id: 36, name: 'Los documentos administrativos' },
          { id: 37, name: 'El sistema operativo Windows' },
          { id: 38, name: 'El explorador de Windows' },
          { id: 39, name: 'Los documentos administrativos (práctico)' },
          { id: 40, name: 'Regulación del archivo de la Administración Pública de Canarias' },
        ],
      },
    ],
    totalTopics: 40,
    aliases: ['gobierno canarias', 'canario', 'canarias', 'auxiliar canarias', 'admin canarias', 'c2 canarias', 'gobcan'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-canarias', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-canarias/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-canarias/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO JUNTA DE CASTILLA-LA MANCHA (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_clm',
    slug: 'auxiliar-administrativo-clm',
    positionType: 'auxiliar_administrativo_clm',
    name: 'Auxiliar Administrativo Junta de Castilla-La Mancha',
    shortName: 'Aux. CLM',
    emoji: '🏰',
    badge: 'C2',
    color: 'orange',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Organización Administrativa',
        subtitle: 'Constitución, Administración, Derecho Administrativo, CLM',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Ley 39/2015 del Procedimiento Administrativo Común (I)' },
          { id: 3, name: 'Ley 40/2015 de Régimen Jurídico del Sector Público (I)' },
          { id: 4, name: 'Ley 40/2015 de Régimen Jurídico del Sector Público (II)' },
          { id: 5, name: 'Calidad de los servicios públicos en la JCCM' },
          { id: 6, name: 'Transparencia en la JCCM' },
          { id: 7, name: 'Seguridad de la información y protección de datos' },
          { id: 8, name: 'Personal al servicio de la JCCM' },
          { id: 9, name: 'El presupuesto de la JCCM' },
          { id: 10, name: 'Estatuto de Autonomía de Castilla-La Mancha' },
          { id: 11, name: 'CLM: características históricas, geográficas, culturales y económicas' },
          { id: 12, name: 'Igualdad efectiva de mujeres y hombres' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Ofimática',
        subtitle: 'Windows, Office 2019, Internet, Teams',
        icon: '💻',
        themes: [
          { id: 13, name: 'Informática básica' },
          { id: 14, name: 'Windows 10: entorno gráfico' },
          { id: 15, name: 'El Explorador de Windows' },
          { id: 16, name: 'Word 2019 (I)' },
          { id: 17, name: 'Word 2019 (II)' },
          { id: 18, name: 'Word 2019 (III)' },
          { id: 19, name: 'Excel 2019 (I)' },
          { id: 20, name: 'Excel 2019 (II)' },
          { id: 21, name: 'Excel 2019 (III)' },
          { id: 22, name: 'Internet: protocolos y servicios' },
          { id: 23, name: 'Outlook 2019' },
          { id: 24, name: 'OneDrive y Microsoft Teams' },
        ],
      },
    ],
    totalTopics: 24,
    aliases: ['castilla la mancha', 'jccm', 'clm', 'castilla mancha', 'auxiliar castilla la mancha', 'toledo', 'ciudad real', 'albacete', 'cuenca', 'guadalajara'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-clm', label: 'Mi Oposición', icon: '🏰', featured: true },
      { href: '/auxiliar-administrativo-clm/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-clm/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO JUNTA DE EXTREMADURA (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_extremadura',
    slug: 'auxiliar-administrativo-extremadura',
    positionType: 'auxiliar_administrativo_extremadura',
    name: 'Auxiliar Administrativo Junta de Extremadura',
    shortName: 'Aux. Extremadura',
    emoji: '🌿',
    badge: 'C2',
    color: 'teal',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Empleo Publico y Organizacion',
        subtitle: 'TREBEP, Funcion Publica Extremadura, PRL, Igualdad',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'Gobierno y Administración de la CAE (I)' },
          { id: 2, name: 'Gobierno y Administración de la CAE (II)' },
          { id: 3, name: 'TREBEP' },
          { id: 4, name: 'Función Pública de Extremadura (I)' },
          { id: 5, name: 'Función Pública de Extremadura (II)' },
          { id: 6, name: 'Función Pública de Extremadura (III)' },
          { id: 7, name: 'Función Pública de Extremadura (IV)' },
          { id: 8, name: 'Función Pública de Extremadura (V)' },
          { id: 9, name: 'Función Pública de Extremadura (VI)' },
          { id: 10, name: 'Personal Laboral - Convenio Colectivo (I)' },
          { id: 11, name: 'Personal Laboral - Convenio Colectivo (II)' },
          { id: 12, name: 'Personal Laboral - Convenio Colectivo (III)' },
          { id: 13, name: 'Prevención de riesgos laborales' },
          { id: 14, name: 'Igualdad y violencia de género en Extremadura' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Derecho Administrativo y Ofimatica',
        subtitle: 'Ley 40/2015, Ley 39/2015, Contratos, Windows, Office',
        icon: '💻',
        themes: [
          { id: 15, name: 'Régimen Jurídico del Sector Público (I)' },
          { id: 16, name: 'Régimen Jurídico del Sector Público (II)' },
          { id: 17, name: 'LPAC (I)' },
          { id: 18, name: 'LPAC (II)' },
          { id: 19, name: 'LPAC (III)' },
          { id: 20, name: 'Contratación del Sector Público' },
          { id: 21, name: 'Documento, registro y archivo' },
          { id: 22, name: 'Administración electrónica de Extremadura (I)' },
          { id: 23, name: 'Administración electrónica de Extremadura (II)' },
          { id: 24, name: 'Windows 10' },
          { id: 25, name: 'Office 365: Word y Excel' },
        ],
      },
    ],
    totalTopics: 25,
    aliases: ['junta extremadura', 'extremadura', 'auxiliar extremadura', 'admin extremadura', 'caceres', 'badajoz'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-extremadura', label: 'Mi Oposicion', icon: '🌿', featured: true },
      { href: '/auxiliar-administrativo-extremadura/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-extremadura/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO GENERALITAT VALENCIANA (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_valencia',
    slug: 'auxiliar-administrativo-valencia',
    positionType: 'auxiliar_administrativo_valencia',
    name: 'Auxiliar Administrativo Generalitat Valenciana',
    shortName: 'Aux. Valencia',
    emoji: '🍊',
    badge: 'C2',
    color: 'red',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Parte General',
        subtitle: 'CE, Estatuto CV, Consell, UE, Igualdad, Transparencia, PRL',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'CE: Titulo Preliminar, Titulo I Derechos y deberes, Titulo VIII Organizacion territorial' },
          { id: 2, name: 'CE: Titulo II Corona, Titulo III Cortes Generales (Cap. I y II)' },
          { id: 3, name: 'CE: Titulo IV Gobierno y Administracion, Titulo V Relaciones Gobierno-Cortes, Titulo VI Poder Judicial' },
          { id: 4, name: 'Estatuto de Autonomia de la Comunitat Valenciana (Titulos I-IV)' },
          { id: 5, name: 'Ley 5/1983 del Consell (I): President de la Generalitat, Del Consell' },
          { id: 6, name: 'Ley 5/1983 del Consell (II): Relaciones Consell-Corts, Admin Publica, Responsabilidad' },
          { id: 7, name: 'Derecho de la UE: Tratado UE, TFUE, actos juridicos' },
          { id: 8, name: 'Igualdad: LO 3/2007, Ley 9/2003 GVA, Ley 4/2023 LGTBI, LO 1/2004 violencia genero' },
          { id: 9, name: 'Transparencia (Ley 19/2013) y Proteccion de datos (LO 3/2018 LOPDGDD)' },
          { id: 10, name: 'Prevencion de Riesgos Laborales: Ley 31/1995 (Cap. I y III)' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Parte Especial',
        subtitle: 'LPAC, Contratos, Funcion Publica, Presupuestos, Informatica',
        icon: '⚖️',
        themes: [
          { id: 11, name: 'Ley 39/2015 (I): Titulo Preliminar, interesados, actividad AAPP, actos administrativos' },
          { id: 12, name: 'Ley 39/2015 (II): Procedimiento administrativo comun, revision en via administrativa' },
          { id: 13, name: 'Ley 40/2015: Titulo Preliminar, organos AAPP (excepto arts. 19-22), relaciones interadministrativas' },
          { id: 14, name: 'Contratos del Sector Publico: Ley 9/2017 (tipos, objeto, expediente)' },
          { id: 15, name: 'Funcion Publica Valenciana: Ley 4/2021 (objeto, personal, nacimiento/extincion, derechos, regimen disciplinario)' },
          { id: 16, name: 'Decreto 42/2019: Condiciones de trabajo del personal funcionario GVA' },
          { id: 17, name: 'Presupuestos GVA (I): Ley 1/2015 Hacienda Publica (programacion, contenido, creditos)' },
          { id: 18, name: 'Presupuestos GVA (II): Ley 1/2015 gestion presupuestaria (ejecucion gasto, pagos, anticipos)' },
          { id: 19, name: 'Admin electronica CV: Decreto 54/2025 (acceso electronico, registro, comunicaciones)' },
          { id: 20, name: 'Atencion a la ciudadania: Decreto 30/2025 (registro, informacion, atencion telefonica)' },
          { id: 21, name: 'Informatica: Windows 11 (escritorio, archivos, herramientas basicas, navegador)' },
          { id: 22, name: 'Comunicacion y colaboracion: Outlook, Teams, OneDrive' },
          { id: 23, name: 'Contenidos digitales: Word, Excel, herramientas IA (nivel usuario)' },
          { id: 24, name: 'Seguridad digital: Orden 19/2013 uso seguro medios tecnologicos GVA' },
        ],
      },
    ],
    totalTopics: 24,
    aliases: ['generalitat valenciana', 'gva', 'comunitat valenciana', 'valenciana', 'auxiliar valencia', 'admin valencia', 'c2 valencia', 'generalitat'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-valencia', label: 'Mi Oposicion', icon: '🍊', featured: true },
      { href: '/auxiliar-administrativo-valencia/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-valencia/test', label: 'Tests', icon: '🎯' },
    ],
    officialExams: [
      {
        date: '2018-09-22',
        title: 'Convocatoria 9/16 (OEP 2016)',
        oep: 'OEP 2016',
        partes: [
          { id: 'unica', icon: '📘', title: 'Ejercicio', description: '50 preguntas (turno libre, conv. 9/16)' },
        ],
      },
      {
        date: '2022-02-12',
        title: 'Convocatoria 9/18 (OEP 2017-2018)',
        oep: 'OEP 2017-2018',
        partes: [
          { id: 'unica', icon: '📘', title: 'Ejercicio', description: '66 preguntas (turno libre, conv. 9/18)' },
        ],
      },
      {
        date: '2023-02-25',
        title: 'Convocatoria 9/22 (OEP 2022)',
        oep: 'OEP 2022',
        partes: [
          { id: 'unica', icon: '📘', title: 'Ejercicio', description: '73 preguntas (turno libre, conv. 9/22)' },
        ],
      },
      {
        date: '2023-11-18',
        title: 'Convocatoria 14/23 (OEP 2023)',
        oep: 'OEP 2023',
        partes: [
          { id: 'unica', icon: '📘', title: 'Ejercicio', description: '73 preguntas (turno libre, conv. 14/23)' },
        ],
      },
    ],
  },

  // ========================================
  // ADMINISTRATIVO GENERALITAT VALENCIANA (C1-01)
  // ========================================
  {
    id: 'administrativo_gva',
    slug: 'administrativo-gva',
    positionType: 'administrativo_gva',
    name: 'Administrativo Generalitat Valenciana',
    shortName: 'Admin. GVA',
    emoji: '🏛️',
    badge: 'C1',
    color: 'amber',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Parte General',
        subtitle: 'CE, Estatuto CV, Consell, UE, Igualdad, Violencia Género, Transparencia',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978: Título Preliminar y Derechos Fundamentales' },
          { id: 2, name: 'La Constitución Española de 1978: Corona y Cortes Generales' },
          { id: 3, name: 'La Constitución Española de 1978: Gobierno y Administración' },
          { id: 4, name: 'La Constitución Española de 1978: Poder Judicial y Tribunal Constitucional' },
          { id: 5, name: 'La Constitución Española de 1978: Organización territorial del Estado' },
          { id: 6, name: 'El Estatuto de Autonomía de la Comunitat Valenciana' },
          { id: 7, name: 'Ley 5/1983 del Consell (I): President, Consell y relaciones con Les Corts' },
          { id: 8, name: 'Ley 5/1983 del Consell (II): Conselleria, Administración Pública y responsabilidad' },
          { id: 9, name: 'El Tratado de la Unión Europea y de Funcionamiento de la UE' },
          { id: 10, name: 'Igualdad de mujeres y hombres + Ley 9/2003 GVA + Ley 4/2023 LGTBI' },
          { id: 11, name: 'Ley Orgánica 1/2004 de protección integral contra la violencia de género' },
          { id: 12, name: 'Transparencia (Ley 19/2013) + Ley 1/2022 GVA de Transparencia' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Parte Especial',
        subtitle: 'Derecho administrativo, Función Pública GVA, Presupuestos, Informática y Ofimática',
        icon: '⚖️',
        themes: [
          { id: 101, displayNumber: 1, name: 'Ley 39/2015 (I): Disposiciones generales, interesados, actividad AAPP' },
          { id: 102, displayNumber: 2, name: 'Ley 39/2015 (II): Actos administrativos' },
          { id: 103, displayNumber: 3, name: 'Ley 39/2015 (III): Procedimiento administrativo común y revisión' },
          { id: 104, displayNumber: 4, name: 'Órganos de las AAPP: principios, competencia, relaciones' },
          { id: 105, displayNumber: 5, name: 'Limitación, fomento + Subvenciones (Ley 38/2003 + Ley 1/2015 GVA)' },
          { id: 106, displayNumber: 6, name: 'Contratos del Sector Público (Ley 9/2017)' },
          { id: 107, displayNumber: 7, name: 'Admin electrónica CV + Protección datos + Decreto 30/2025 GVA' },
          { id: 108, displayNumber: 8, name: 'Función pública: TREBEP + Ley 4/2021 LFPV' },
          { id: 109, displayNumber: 9, name: 'Personal al servicio de las AAPP: clases y estructura' },
          { id: 110, displayNumber: 10, name: 'Situaciones administrativas, derechos, disciplinario, provisión' },
          { id: 111, displayNumber: 11, name: 'Presupuesto Generalitat (I): Concepto y elaboración' },
          { id: 112, displayNumber: 12, name: 'Presupuesto Generalitat (II): Gestión y modificaciones' },
          { id: 113, displayNumber: 13, name: 'Control interno + Tribunal Cuentas + Sindicatura' },
          { id: 114, displayNumber: 14, name: 'Ley 1/2015 Hacienda GVA: Contabilidad' },
          { id: 115, displayNumber: 15, name: 'Informática básica' },
          { id: 116, displayNumber: 16, name: 'Sistema operativo Windows 11' },
          { id: 117, displayNumber: 17, name: 'Explorador de archivos Windows 11 + OneDrive' },
          { id: 118, displayNumber: 18, name: 'Outlook Microsoft 365' },
          { id: 119, displayNumber: 19, name: 'Word Microsoft 365' },
          { id: 120, displayNumber: 20, name: 'Excel Microsoft 365' },
          { id: 121, displayNumber: 21, name: 'Teams Microsoft 365' },
          { id: 122, displayNumber: 22, name: 'Navegadores web' },
          { id: 123, displayNumber: 23, name: 'Herramientas de IA' },
        ],
      },
    ],
    totalTopics: 35,
    aliases: ['administrativo generalitat', 'administrativo gva', 'administrativo valencia', 'gva', 'c1 valencia', 'c1-01 gva', 'cuerpo administrativo', 'administrativo c1', 'administrativo comunitat valenciana'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/administrativo-gva', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/administrativo-gva/temario', label: 'Temario', icon: '📚' },
      { href: '/administrativo-gva/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO XUNTA DE GALICIA (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_galicia',
    slug: 'auxiliar-administrativo-galicia',
    positionType: 'auxiliar_administrativo_galicia',
    name: 'Auxiliar Administrativo Xunta de Galicia',
    shortName: 'Aux. Galicia',
    emoji: '🐚',
    badge: 'C2',
    color: 'sky',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Parte General',
        subtitle: 'CE, Estatuto Galicia, UE, LPAC, LRJSP, Empleo Publico, Igualdad',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Estatuto de Autonomía de Galicia' },
          { id: 3, name: 'La Unión Europea y el derecho derivado' },
          { id: 4, name: 'Las instituciones de la Unión Europea' },
          { id: 5, name: 'Ley 31/1995 de prevención de riesgos laborales' },
          { id: 6, name: 'Ley 16/2010 de organización de la Administración de Galicia' },
          { id: 7, name: 'Ley 39/2015 del Procedimiento Administrativo Común' },
          { id: 8, name: 'Ley 40/2015 de Régimen Jurídico del Sector Público' },
          { id: 9, name: 'Régimen financiero y presupuestario de Galicia' },
          { id: 10, name: 'Ley 1/2016 de transparencia y buen gobierno' },
          { id: 11, name: 'Ley 2/2015 del empleo público de Galicia' },
          { id: 12, name: 'Igualdad en materia de género en Galicia' },
          { id: 13, name: 'RDL 1/2013 Derechos de las personas con discapacidad' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Parte Especifica',
        subtitle: 'Gestion documental, Informatica, Ofimatica',
        icon: '💻',
        themes: [
          { id: 14, name: 'Gestión de documentos en la Xunta de Galicia' },
          { id: 15, name: 'Informática básica' },
          { id: 16, name: 'Sistemas operativos' },
          { id: 17, name: 'Sistemas ofimáticos' },
        ],
      },
    ],
    totalTopics: 17,
    aliases: ['xunta galicia', 'xunta', 'galicia', 'auxiliar galicia', 'c2 galicia', 'xunta de galicia', 'sergas'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-galicia', label: 'Mi Oposicion', icon: '🐚', featured: true },
      { href: '/auxiliar-administrativo-galicia/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-galicia/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // ADMINISTRATIVO XUNTA DE GALICIA (C1)
  // ========================================
  {
    id: 'administrativo_galicia',
    slug: 'administrativo-galicia',
    positionType: 'administrativo_galicia',
    name: 'Administrativo Xunta de Galicia',
    shortName: 'Adm. Galicia',
    emoji: '🐚',
    badge: 'C1',
    color: 'emerald',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Parte General',
        subtitle: 'CE, Estatuto Galicia, Unión Europea, Prevención de riesgos laborales',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Estatuto de Autonomía de Galicia' },
          { id: 3, name: 'La Unión Europea y el derecho derivado' },
          { id: 4, name: 'Fuentes del derecho europeo' },
          { id: 5, name: 'Las instituciones de la Unión Europea' },
          { id: 6, name: 'Las competencias de la Unión Europea' },
          { id: 7, name: 'Ley 31/1995 de prevención de riesgos laborales' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Parte Específica',
        subtitle: 'LPAC, LRJSP, Contratos, Subvenciones, Empleo Público, ET, Seg. Social',
        icon: '⚖️',
        themes: [
          { id: 8, name: 'Ley 39/2015 del Procedimiento Administrativo Común' },
          { id: 9, name: 'Ley 40/2015 de Régimen Jurídico del Sector Público' },
          { id: 10, name: 'Ley 16/2010 de organización de la Administración de Galicia' },
          { id: 11, name: 'Ley 9/2017 de Contratos del Sector Público' },
          { id: 12, name: 'Ley 9/2007 de Subvenciones de Galicia' },
          { id: 13, name: 'Ley 2/2015 del Empleo Público de Galicia' },
          { id: 14, name: 'Régimen financiero y presupuestario de Galicia' },
          { id: 15, name: 'RDL 1/2013 Derechos de las personas con discapacidad' },
          { id: 16, name: 'Ley 1/2016 de Transparencia y Buen Gobierno' },
          { id: 17, name: 'Ley 7/2023 de Igualdad de Galicia' },
          { id: 18, name: 'Estatuto de los Trabajadores' },
          { id: 19, name: 'Ley General de la Seguridad Social' },
        ],
      },
    ],
    totalTopics: 19,
    aliases: ['xunta galicia', 'xunta', 'galicia', 'administrativo galicia', 'admin galicia', 'c1 galicia', 'xunta de galicia'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/administrativo-galicia', label: 'Mi Oposicion', icon: '🐚', featured: true },
      { href: '/administrativo-galicia/temario', label: 'Temario', icon: '📚' },
      { href: '/administrativo-galicia/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO DGA ARAGÓN (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_aragon',
    slug: 'auxiliar-administrativo-aragon',
    positionType: 'auxiliar_administrativo_aragon',
    name: 'Auxiliar Administrativo de Aragón',
    shortName: 'Aux. Aragón',
    emoji: '🏔️',
    badge: 'C2',
    color: 'yellow',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Materias Comunes',
        subtitle: 'CE, Estatuto Aragón, Gobierno Aragón, LPAC, LRJSP, Igualdad, Transparencia',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'La organización territorial del Estado' },
          { id: 3, name: 'La Unión Europea' },
          { id: 4, name: 'El Estatuto de Autonomía de Aragón' },
          { id: 5, name: 'Los órganos de gobierno de la Comunidad Autónoma de Aragón' },
          { id: 6, name: 'El derecho administrativo y sus fuentes' },
          { id: 7, name: 'Las disposiciones administrativas' },
          { id: 8, name: 'Eficacia y validez de los actos administrativos' },
          { id: 9, name: 'La protección de datos personales' },
          { id: 10, name: 'Igualdad efectiva de mujeres y hombres' },
          { id: 11, name: 'Información y atención al público' },
          { id: 12, name: 'Los documentos administrativos' },
          { id: 13, name: 'El Gobierno Abierto' },
          { id: 14, name: 'Prevención de Riesgos Laborales' },
          { id: 15, name: 'La Administración electrónica' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Materias Específicas',
        subtitle: 'Informática, Windows, Word, Excel, Correo e Internet',
        icon: '💻',
        themes: [
          { id: 16, name: 'Informática básica' },
          { id: 17, name: 'Sistema operativo Windows' },
          { id: 18, name: 'Procesador de textos Word' },
          { id: 19, name: 'Hoja de cálculo Excel' },
          { id: 20, name: 'Correo electrónico e Internet' },
        ],
      },
    ],
    totalTopics: 20,
    aliases: ['gobierno aragon', 'dga', 'aragon', 'auxiliar aragon', 'admin aragon', 'c2 aragon', 'zaragoza'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-aragon', label: 'Mi Oposición', icon: '🏔️', featured: true },
      { href: '/auxiliar-administrativo-aragon/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-aragon/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO PRINCIPADO DE ASTURIAS (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_asturias',
    slug: 'auxiliar-administrativo-asturias',
    positionType: 'auxiliar_administrativo_asturias',
    name: 'Auxiliar Administrativo del Principado de Asturias',
    shortName: 'Aux. Asturias',
    emoji: '⛰️',
    badge: 'C2',
    color: 'indigo',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Derecho Constitucional y Organización Administrativa',
        subtitle: 'CE, AGE, Estatuto Asturias, Gobierno Asturias',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978 (I)' },
          { id: 2, name: 'La Constitución Española de 1978 (II)' },
          { id: 3, name: 'La Constitución Española de 1978 (III)' },
          { id: 4, name: 'La Administración General del Estado' },
          { id: 5, name: 'El Estatuto de Autonomía del Principado de Asturias' },
          { id: 6, name: 'El Presidente y Consejo de Gobierno del Principado de Asturias' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Derecho Administrativo y Comunitario',
        subtitle: 'UE, LPAC, LRJSP, TREBEP, LGSS, Igualdad, Transparencia',
        icon: '⚖️',
        themes: [
          { id: 7, name: 'La Ley 39/2015, del Procedimiento Administrativo Común' },
          { id: 8, name: 'La Ley 40/2015, de Régimen Jurídico del Sector Público' },
          { id: 9, name: 'Régimen Jurídico de la Administración del Principado de Asturias (Ley 2/1995)' },
          { id: 10, name: 'El Estatuto Básico del Empleado Público (TREBEP)' },
          { id: 11, name: 'Ley 2/2023 de Empleo Público del Principado de Asturias' },
          { id: 12, name: 'Función Pública del Principado de Asturias' },
          { id: 13, name: 'Convenio Colectivo del personal laboral del Principado' },
          { id: 14, name: 'Régimen Económico y Presupuestario del Principado' },
          { id: 15, name: 'La Ley General de la Seguridad Social (I)' },
          { id: 16, name: 'La Ley General de la Seguridad Social (II)' },
          { id: 17, name: 'Atención Ciudadana en el Principado de Asturias' },
          { id: 18, name: 'La documentación administrativa' },
          { id: 19, name: 'Protección de datos y transparencia' },
          { id: 20, name: 'Igualdad y discapacidad' },
        ],
      },
      {
        id: 'bloque3',
        title: 'Bloque III: Ofimática',
        subtitle: 'Windows, Word, Excel, Access',
        icon: '💻',
        themes: [
          { id: 21, name: 'Sistema operativo Windows' },
          { id: 22, name: 'Explorador de Windows' },
          { id: 23, name: 'Procesador de textos Word' },
          { id: 24, name: 'Hoja de cálculo Excel' },
          { id: 25, name: 'Base de datos Access' },
        ],
      },
    ],
    totalTopics: 25,
    aliases: ['principado asturias', 'asturias', 'auxiliar asturias', 'admin asturias', 'principado', 'oviedo', 'gijon'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-asturias', label: 'Mi Oposición', icon: '⛰️', featured: true },
      { href: '/auxiliar-administrativo-asturias/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-asturias/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO ILLES BALEARS (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_baleares',
    slug: 'auxiliar-administrativo-baleares',
    positionType: 'auxiliar_administrativo_baleares',
    name: 'Auxiliar Administrativo de la CAIB',
    shortName: 'Aux. Baleares',
    emoji: '🏝️',
    badge: 'C2',
    color: 'cyan',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Materias Comunes',
        subtitle: 'CE, Estatuto Baleares, LPAC, LRJSP, TREBEP, Contratación, Transparencia, Igualdad',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'CE y Estatuto de Autonomía de las Illes Balears' },
          { id: 2, name: 'Parlamento, Presidente y Gobierno de las Illes Balears' },
          { id: 3, name: 'Régimen Jurídico del Sector Público y organización administrativa' },
          { id: 4, name: 'Fuentes del derecho y jerarquía normativa' },
          { id: 5, name: 'Procedimiento Administrativo Común (I)' },
          { id: 6, name: 'Procedimiento Administrativo Común (II)' },
          { id: 7, name: 'Procedimiento Administrativo Común (III)' },
          { id: 8, name: 'El Butlletí Oficial de les Illes Balears' },
          { id: 9, name: 'Archivos y gestión documental en la Administración de las Illes Balears' },
          { id: 10, name: 'Relaciones electrónicas con las administraciones públicas y atención a la ciudadanía' },
          { id: 11, name: 'Oficinas de asistencia en materia de registros, registro electrónico y DIR3' },
          { id: 12, name: 'Contratación administrativa: tipos y procedimientos' },
          { id: 13, name: 'Personal funcionario: adquisición de la condición y procesos selectivos' },
          { id: 14, name: 'Derechos, deberes, incompatibilidades y régimen disciplinario de los funcionarios' },
          { id: 15, name: 'Presupuestos generales de las Illes Balears' },
          { id: 16, name: 'Prevención de riesgos laborales en la Administración pública' },
          { id: 17, name: 'Transparencia: publicidad activa y derecho de acceso a la información pública' },
          { id: 18, name: 'Funcionamiento electrónico del sector público, interoperabilidad y plataformas digitales' },
          { id: 19, name: 'Igualdad, no discriminación y prevención de la violencia de género' },
          { id: 20, name: 'Herramientas de administración digital de la CAIB' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Ofimática',
        subtitle: 'Microsoft Word y Microsoft Excel',
        icon: '💻',
        themes: [
          { id: 21, name: 'Word: conceptos básicos de edición de texto' },
          { id: 22, name: 'Word: formato de fuente y párrafo, buscar y reemplazar' },
          { id: 23, name: 'Word: estilos' },
          { id: 24, name: 'Word: formato de página, encabezados, pies de página y numeración' },
          { id: 25, name: 'Word: inserción de imágenes y tablas' },
          { id: 26, name: 'Word: tabla de contenidos y notas al pie' },
          { id: 27, name: 'Word: combinación de correspondencia' },
          { id: 28, name: 'Word: corrección ortográfica y comparación de documentos' },
          { id: 29, name: 'Word: formularios con controles de contenido' },
          { id: 30, name: 'Excel: operaciones básicas, gestión de archivos y formato de celdas' },
          { id: 31, name: 'Excel: tablas, gráficos y funciones de filtrado' },
          { id: 32, name: 'Excel: diseño de página e impresión' },
          { id: 33, name: 'Excel: fórmulas y funciones estadísticas' },
          { id: 34, name: 'Excel: ortografía y protección de documentos' },
          { id: 35, name: 'Excel: vistas y zoom' },
          { id: 36, name: 'Excel: tablas dinámicas y análisis de escenarios' },
        ],
      },
    ],
    totalTopics: 36,
    aliases: ['govern balear', 'illes balears', 'baleares', 'islas baleares', 'auxiliar baleares', 'mallorca', 'ibiza', 'menorca', 'caib'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-baleares', label: 'Mi Oposición', icon: '🏝️', featured: true },
      { href: '/auxiliar-administrativo-baleares/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-baleares/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIO JUDICIAL (C2)
  // ========================================
  {
    id: 'auxilio_judicial',
    slug: 'auxilio-judicial',
    positionType: 'auxilio_judicial',
    name: 'Auxilio Judicial',
    shortName: 'Auxilio Jud.',
    emoji: '⚖️',
    badge: 'C2',
    color: 'purple',
    administracion: 'justicia',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Derecho Constitucional y Organización del Estado',
        subtitle: 'Constitución y Organización del Estado',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Igualdad y no discriminación' },
          { id: 3, name: 'El Gobierno y la Administración' },
          { id: 4, name: 'Organización territorial del Estado' },
          { id: 5, name: 'La Unión Europea' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Organización Judicial y Funcionarios',
        subtitle: 'Poder Judicial, Tribunales y Funcionarios',
        icon: '⚖️',
        themes: [
          { id: 6, name: 'El Poder Judicial' },
          { id: 7, name: 'Órganos jurisdiccionales superiores' },
          { id: 8, name: 'Órganos jurisdiccionales de instancia' },
          { id: 9, name: 'Derechos de los ciudadanos ante la Justicia' },
          { id: 10, name: 'Modernización de la oficina judicial' },
          { id: 11, name: 'El Letrado de la Administración de Justicia' },
          { id: 12, name: 'Los Cuerpos de Funcionarios' },
          { id: 13, name: 'Ingreso y carrera de los funcionarios' },
          { id: 14, name: 'Situaciones administrativas y régimen disciplinario' },
          { id: 15, name: 'Libertad sindical y prevención de riesgos' },
        ],
      },
      {
        id: 'bloque3',
        title: 'Bloque III: Procedimientos y Actos Procesales',
        subtitle: 'Procedimientos, Registros y Archivo',
        icon: '📜',
        themes: [
          { id: 16, name: 'Procedimientos civiles declarativos' },
          { id: 17, name: 'Procedimientos civiles de ejecución' },
          { id: 18, name: 'Procedimientos penales' },
          { id: 19, name: 'Procedimientos contencioso-administrativos' },
          { id: 20, name: 'El proceso laboral' },
          { id: 21, name: 'Los actos procesales' },
          { id: 22, name: 'Resoluciones de órganos judiciales' },
          { id: 23, name: 'Comunicación con tribunales y autoridades' },
          { id: 24, name: 'Comunicación con las partes' },
          { id: 25, name: 'El Registro Civil' },
          { id: 26, name: 'El archivo judicial' },
        ],
      },
    ],
    totalTopics: 26,
    aliases: ['auxilio', 'judicial', 'auxilio judicial', 'turno libre auxilio'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxilio-judicial', label: 'Mi Oposición', icon: '⚖️', featured: true },
      { href: '/auxilio-judicial/temario', label: 'Temario', icon: '📚' },
      { href: '/auxilio-judicial/test', label: 'Tests', icon: '🎯' },
    ],
    officialExams: [
      {
        date: '2024-09-28',
        title: 'Convocatoria 28 septiembre 2024',
        oep: 'OEP 2023',
        partes: [
          { id: 'primera', icon: '📘', title: 'Primer ejercicio', description: 'Test teórico — 85 preguntas (de 100 oficiales BOE)' },
          { id: 'segunda', icon: '📗', title: 'Segundo ejercicio', description: 'Supuesto práctico — 35 preguntas (de 40 oficiales BOE)' },
        ],
        note: 'Preguntas importadas de repasandosinpapeles.com (Modelo A, sin reservas/anuladas).',
      },
      {
        date: '2025-09-27',
        title: 'Convocatoria 27 septiembre 2025',
        oep: 'OEP 2024',
        partes: [
          { id: 'primera', icon: '📘', title: 'Primer ejercicio', description: 'Test teórico — 85 preguntas (de 100 oficiales BOE)' },
        ],
        note: 'Preguntas importadas de mjusticia.gob.es. Falta importar el supuesto práctico (40 preguntas).',
      },
    ],
  },
  // ========================================
  // AUXILIAR ADMINISTRATIVO AYUNTAMIENTO DE VALENCIA (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_ayuntamiento_valencia',
    slug: 'auxiliar-administrativo-ayuntamiento-valencia',
    positionType: 'auxiliar_administrativo_ayuntamiento_valencia',
    name: 'Auxiliar Administrativo del Ayuntamiento de Valencia',
    shortName: 'Aux. Ayto. Valencia',
    emoji: '🏛️',
    badge: 'C2',
    color: 'orange',
    administracion: 'local',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Derecho Constitucional y Administrativo',
        subtitle: 'Constitución, procedimiento y organización',
        icon: '⚖️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978. Principios generales. Derechos y libertades fundamentales' },
          { id: 2, name: 'La Corona. Las Cortes Generales. El Tribunal Constitucional' },
          { id: 3, name: 'El Gobierno y la Administración. Ley Orgánica 3/2018, de Protección de Datos' },
          { id: 4, name: 'La organización territorial del Estado. Comunidades Autónomas. Estatutos de Autonomía' },
          { id: 5, name: 'Fuentes del derecho público. La Ley y otras fuentes' },
          { id: 6, name: 'El procedimiento administrativo. Ley 39/2015' },
          { id: 7, name: 'Fases del procedimiento administrativo. Silencio administrativo. Ejecución' },
          { id: 8, name: 'Validez de los actos administrativos. Recursos administrativos y contencioso-administrativo' },
          { id: 9, name: 'La Ley de Prevención de Riesgos Laborales' },
          { id: 10, name: 'Ley 40/2015. Organización administrativa y principios' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Administración Local',
        subtitle: 'Régimen local, haciendas y organización municipal',
        icon: '🏘️',
        themes: [
          { id: 11, name: 'Régimen Local Español. La Provincia' },
          { id: 12, name: 'El Municipio. Empadronamiento. Participación ciudadana' },
          { id: 13, name: 'Competencias municipales y órganos municipales' },
          { id: 14, name: 'Ordenanzas y Reglamentos de las Entidades Locales' },
          { id: 15, name: 'Funcionamiento de los órganos colegiados locales' },
          { id: 16, name: 'Personal al servicio de la Administración Local. Función Pública Local' },
          { id: 17, name: 'Contratación del sector público' },
          { id: 18, name: 'Licencias y servicios públicos locales' },
          { id: 19, name: 'Haciendas Locales y ordenanzas fiscales' },
          { id: 20, name: 'Igualdad efectiva y Proteccion Integral contra Violencia de Genero. Plan de Igualdad Ayto. Valencia' },
          { id: 21, name: 'Plataforma Integral de Administración Electrónica del Ayuntamiento de València (PIAE)' },
        ],
      },
    ],
    totalTopics: 21,
    aliases: ['ayuntamiento valencia', 'ajuntament', 'ayto valencia', 'ayuntamiento de valencia'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-ayuntamiento-valencia', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-ayuntamiento-valencia/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-ayuntamiento-valencia/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // AUXILIAR ADMINISTRATIVO CANTABRIA (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_cantabria',
    slug: 'auxiliar-administrativo-cantabria',
    positionType: 'auxiliar_administrativo_cantabria',
    name: 'Auxiliar Administrativo Gobierno de Cantabria',
    shortName: 'Aux. Cantabria',
    emoji: '⛰️',
    badge: 'C2',
    color: 'teal',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Parte General',
        subtitle: 'Derecho, Administración y Función Pública',
        icon: '⚖️',
        themes: [
          { id: 1, name: 'La Unión Europea' },
          { id: 2, name: 'La Constitución Española de 1978' },
          { id: 3, name: 'El Estatuto de Autonomía para Cantabria' },
          { id: 4, name: 'Régimen Jurídico del Gobierno de Cantabria (Ley 5/2018)' },
          { id: 5, name: 'Ley 39/2015 del Procedimiento Administrativo Común' },
          { id: 6, name: 'Ley 40/2015 de Régimen Jurídico del Sector Público' },
          { id: 7, name: 'Personal al servicio de la Administración de Cantabria' },
          { id: 8, name: 'Derechos y deberes de los funcionarios de Cantabria' },
          { id: 9, name: 'Ley General de la Seguridad Social' },
          { id: 10, name: 'Ley de Transparencia de Cantabria (Ley 1/2018)' },
          { id: 11, name: 'Ley 31/1995 de Prevención de Riesgos Laborales' },
          { id: 12, name: 'Igualdad y violencia de género' },
          { id: 13, name: 'Derechos de personas con discapacidad (RDLeg 1/2013)' },
          { id: 14, name: 'Carta de Derechos de la Ciudadanía (Decreto 152/2005)' },
          { id: 15, name: 'Protección de datos (LO 3/2018)' },
          { id: 16, name: 'Atención Ciudadana y Registro Electrónico' },
          { id: 17, name: 'Archivos de Cantabria (Ley 3/2002)' },
          { id: 18, name: 'Administración electrónica Cantabria (Decreto 60/2018)' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Parte Específica: Informática',
        subtitle: 'Windows 10, Office 2016 e Internet',
        icon: '💻',
        themes: [
          { id: 19, name: 'El entorno Microsoft Windows 10' },
          { id: 20, name: 'El Explorador de Archivos en Windows 10' },
          { id: 21, name: 'Microsoft Word 2016 (I)' },
          { id: 22, name: 'Microsoft Word 2016 (II)' },
          { id: 23, name: 'Microsoft Excel 2016' },
          { id: 24, name: 'Correo electrónico y Microsoft Outlook 2016' },
          { id: 25, name: 'La Red Internet' },
        ],
      },
    ],
    totalTopics: 25,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-cantabria', label: 'Mi Oposición', icon: '⛰️', featured: true },
      { href: '/auxiliar-administrativo-cantabria/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-cantabria/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // ADMINISTRATIVO NAVARRA (Nivel C / C1)
  // ========================================
  {
    id: 'administrativo_navarra',
    slug: 'administrativo-navarra',
    positionType: 'administrativo_navarra',
    name: 'Administrativo del Gobierno de Navarra',
    shortName: 'Admin. Navarra',
    emoji: '🏰',
    badge: 'C1',
    color: 'red',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Actividad Administrativa',
        subtitle: 'Atención ciudadana, registro y documentación',
        icon: '📋',
        themes: [
          { id: 1, name: 'Derechos de las personas en sus relaciones con la Administración' },
          { id: 2, name: 'Protección de datos, comunicación oral y escrita' },
          { id: 3, name: 'Funcionamiento electrónico de la Administración Foral' },
          { id: 4, name: 'Registros, archivo y documentación' },
          { id: 5, name: 'Documentación administrativa' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Normativa',
        subtitle: 'Constitución, Navarra y Administración',
        icon: '⚖️',
        themes: [
          { id: 6, name: 'La Constitución Española de 1978' },
          { id: 7, name: 'La Unión Europea: instituciones' },
          { id: 8, name: 'Las Fuentes del Derecho' },
          { id: 9, name: 'Ley Orgánica de Reintegración y Amejoramiento del Régimen Foral de Navarra' },
          { id: 10, name: 'El Parlamento de Navarra' },
          { id: 11, name: 'El Gobierno de Navarra' },
          { id: 12, name: 'Ley Foral 11/2019 Administración de Navarra' },
          { id: 13, name: 'Actos administrativos' },
          { id: 14, name: 'Procedimiento administrativo' },
          { id: 15, name: 'Estatuto del Personal de Navarra (I)' },
          { id: 16, name: 'Estatuto del Personal de Navarra (II): Ingreso y carrera' },
          { id: 17, name: 'Estatuto del Personal de Navarra (III): Provisión y derechos' },
          { id: 18, name: 'Igualdad de género (LO 3/2007 + Ley Foral 17/2019)' },
          { id: 19, name: 'Transparencia Navarra (Ley Foral 5/2018)' },
          { id: 20, name: 'Hacienda Pública de Navarra' },
          { id: 21, name: 'Presupuestos Generales de Navarra' },
          { id: 22, name: 'Contratos Públicos Navarra (Ley Foral 2/2018)' },
          { id: 23, name: 'Subvenciones Navarra (Ley Foral 11/2005)' },
        ],
      },
      {
        id: 'bloque3',
        title: 'Bloque III: Informática',
        subtitle: 'Windows 10, Word, Excel y Access',
        icon: '💻',
        themes: [
          { id: 24, name: 'Windows 10' },
          { id: 25, name: 'Microsoft Word 2021' },
          { id: 26, name: 'Microsoft Excel 2021' },
          { id: 27, name: 'Microsoft Access 2021' },
        ],
      },
    ],
    totalTopics: 27,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/administrativo-navarra', label: 'Mi Oposición', icon: '🏰', featured: true },
      { href: '/administrativo-navarra/temario', label: 'Temario', icon: '📚' },
      { href: '/administrativo-navarra/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // AUXILIAR ADMINISTRATIVO LA RIOJA (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_la_rioja',
    slug: 'auxiliar-administrativo-la-rioja',
    positionType: 'auxiliar_administrativo_la_rioja',
    name: 'Auxiliar Administrativo Gobierno de La Rioja',
    shortName: 'Aux. La Rioja',
    emoji: '🍇',
    badge: 'C2',
    color: 'rose',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Parte General',
        subtitle: 'Constitución, Autonomía y Administración',
        icon: '⚖️',
        themes: [
          { id: 1, name: 'Atención al ciudadano y servicios de información' },
          { id: 2, name: 'El Registro en la Administración de La Rioja' },
          { id: 3, name: 'La Constitución Española (I): estructura y derechos' },
          { id: 4, name: 'La Constitución Española (II): TC y Corona' },
          { id: 5, name: 'Las Cortes Generales' },
          { id: 6, name: 'Organización de la Administración del Estado y local' },
          { id: 7, name: 'Estatuto de Autonomía de La Rioja (I)' },
          { id: 8, name: 'Estatuto de Autonomía de La Rioja (II)' },
          { id: 9, name: 'Estatuto de Autonomía de La Rioja (III)' },
          { id: 10, name: 'Ley 39/2015 (I): interesados y actividad AAPP' },
          { id: 11, name: 'Procedimiento Administrativo Común (II): actos administrativos' },
          { id: 12, name: 'Ley 39/2015 (III): procedimiento administrativo' },
          { id: 13, name: 'Ley 39/2015 (IV): revisión y recursos' },
          { id: 14, name: 'Ley 40/2015: órganos de las AAPP' },
          { id: 15, name: 'Funcionamiento y régimen jurídico de la Administración de La Rioja' },
          { id: 16, name: 'Organización del sector público de La Rioja' },
          { id: 17, name: 'Función Pública de La Rioja (I)' },
          { id: 18, name: 'Función Pública de La Rioja (II)' },
          { id: 19, name: 'Protección de datos (LO 3/2018)' },
          { id: 20, name: 'Transparencia y buen gobierno de La Rioja' },
          { id: 21, name: 'Igualdad y violencia de género en La Rioja' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Informática',
        subtitle: 'Word 2016',
        icon: '💻',
        themes: [
          { id: 22, name: 'Word 2016 (I)' },
          { id: 23, name: 'Word 2016 (II)' },
        ],
      },
    ],
    totalTopics: 23,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-la-rioja', label: 'Mi Oposición', icon: '🍇', featured: true },
      { href: '/auxiliar-administrativo-la-rioja/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-la-rioja/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // ENFERMERO/A SAS ANDALUCÍA (A2)
  // ========================================
  {
    id: 'enfermero_sas_andalucia',
    slug: 'enfermero-sas-andalucia',
    positionType: 'enfermero_sas_andalucia',
    name: 'Enfermero/a del Servicio Andaluz de Salud (SAS)',
    shortName: 'Enfermero SAS',
    emoji: '🏥',
    badge: 'A2',
    color: 'green',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Temario Común',
        subtitle: 'Legislación, organización sanitaria e igualdad',
        icon: '⚖️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978: derechos, deberes y poderes públicos' },
          { id: 2, name: 'Estatuto de Autonomía de Andalucía: competencias en salud' },
          { id: 3, name: 'Organización sanitaria (I): Ley General de Sanidad y Ley de Salud de Andalucía' },
          { id: 4, name: 'Organización sanitaria (II): Consejería de Salud y Servicio Andaluz de Salud' },
          { id: 5, name: 'Protección de datos personales y transparencia pública en Andalucía' },
          { id: 6, name: 'Prevención de riesgos laborales: derechos y obligaciones' },
          { id: 7, name: 'Igualdad de género y violencia de género en Andalucía' },
          { id: 8, name: 'Estatuto Marco del personal estatutario de los servicios de salud' },
          { id: 9, name: 'Autonomía del paciente: información, consentimiento e historia clínica' },
          { id: 10, name: 'TIC en el Servicio Andaluz de Salud: sistemas de información y ciberseguridad' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Temario Específico',
        subtitle: 'Enfermería clínica, salud pública e investigación',
        icon: '💉',
        themes: [
          { id: 11, name: 'Sistema Nacional de Salud: Ley de cohesión y calidad' },
          { id: 12, name: 'Epidemiología y Salud Pública: demografía e indicadores' },
          { id: 13, name: 'Calidad en el Sistema Sanitario: evaluación y mejora continua' },
          { id: 14, name: 'Derechos y garantías de los usuarios del SSPA y cartera de servicios' },
          { id: 15, name: 'Responsabilidad patrimonial de las Administraciones Públicas' },
          { id: 16, name: 'Formación y desarrollo profesional: ordenación de profesiones sanitarias' },
          { id: 17, name: 'Gestión sanitaria y economía de la salud: conceptos básicos' },
          { id: 18, name: 'Planificación sanitaria: problemas e indicadores' },
          { id: 19, name: 'Sistemas de información sanitaria: DIRAYA y CMBD' },
          { id: 20, name: 'Investigación cuantitativa y estadística en salud' },
          { id: 21, name: 'Investigación cualitativa en salud' },
          { id: 22, name: 'Proyectos de investigación en el ámbito sanitario' },
          { id: 23, name: 'Enfermería Basada en la Evidencia: niveles y recomendaciones' },
          { id: 24, name: 'Gestión por Procesos Asistenciales Integrados (PAIs)' },
          { id: 25, name: 'Bioética: principios y conflictos éticos en enfermería' },
          { id: 26, name: 'Modelo de Gestión de Cuidados en Andalucía' },
          { id: 27, name: 'Gestión de casos: modelo andaluz' },
          { id: 28, name: 'Seguimiento de pacientes por vía telefónica y telecontinuidad' },
          { id: 29, name: 'Fundamentos de la Enfermería: modelos y teorías' },
          { id: 30, name: 'El Proceso Enfermero: valoración y taxonomías' },
          { id: 31, name: 'Educación para la salud individual, grupal y comunitaria' },
          { id: 32, name: 'Comunicación y relación enfermera-paciente' },
          { id: 33, name: 'Epidemiología: enfermedades transmisibles e infecciones asistenciales' },
          { id: 34, name: 'Clasificación de medicamentos: absorción, distribución y eliminación' },
          { id: 35, name: 'Actuación enfermera en la prestación farmacéutica del SSPA' },
          { id: 36, name: 'Seguridad clínica en la administración de fármacos' },
          { id: 37, name: 'Promoción de la actividad física y alimentación saludable' },
          { id: 38, name: 'Cuidados de enfermería en alteraciones nutricionales' },
          { id: 39, name: 'Atención a personas con ansiedad, depresión y somatizaciones' },
          { id: 40, name: 'Atención a la persona con trastorno mental grave y su familia' },
          { id: 41, name: 'Prevención del consumo de tabaco, alcohol y otras sustancias' },
          { id: 42, name: 'Urgencias y emergencias en el SSPA: conceptos y sistemas' },
          { id: 43, name: 'Paciente crítico: valoración, cuidados y soporte vital' },
          { id: 44, name: 'Valoración y cuidados al paciente quirúrgico' },
          { id: 45, name: 'Manejo de heridas y cuidados de la piel' },
          { id: 46, name: 'Inmunizaciones: clasificación, indicaciones y contraindicaciones' },
          { id: 47, name: 'Desarrollo de la conducta humana: etapas del desarrollo' },
          { id: 48, name: 'Valoración y cuidados del recién nacido sano' },
          { id: 49, name: 'Valoración y cuidados del recién nacido enfermo' },
          { id: 50, name: 'Cuidados en la infancia: controles en Atención Primaria' },
          { id: 51, name: 'Cuidados en la adolescencia: características y atención' },
          { id: 52, name: 'Género y salud: perspectiva de género en la atención sanitaria' },
          { id: 53, name: 'Actuación ante violencia de género y en la infancia' },
          { id: 54, name: 'Valoración y cuidados de enfermería en la mujer gestante' },
          { id: 55, name: 'Atención sanitaria a la diversidad de género y sexualidad' },
          { id: 56, name: 'Salud sexual y prevención de infecciones de transmisión sexual' },
          { id: 57, name: 'Cuidados en enfermedades infecciosas: VIH, tuberculosis, hepatitis' },
          { id: 58, name: 'Autonomía, fragilidad, dependencia y discapacidad' },
          { id: 59, name: 'Examen de salud para mayores de 65 años' },
          { id: 60, name: 'Atención domiciliaria y hospitalización domiciliaria' },
          { id: 61, name: 'Atención a la familia ante acontecimientos vitales complejos' },
          { id: 62, name: 'Comunidad y promoción de la salud comunitaria' },
          { id: 63, name: 'Plan andaluz de atención a pacientes con enfermedades crónicas' },
          { id: 64, name: 'Atención a personas con dolor: tipos y escalas de medida' },
          { id: 65, name: 'Prevención de caídas basada en la evidencia' },
          { id: 66, name: 'Atención enfermera a personas en situación de dependencia' },
          { id: 67, name: 'Cuidados de enfermería en problemas cardiovasculares' },
          { id: 68, name: 'Cuidados de enfermería en problemas respiratorios' },
          { id: 69, name: 'Cuidados de enfermería en problemas endocrinológicos y diabetes' },
          { id: 70, name: 'Cuidados de enfermería en problemas músculo-esqueléticos' },
          { id: 71, name: 'Cuidados de enfermería en problemas renales y urológicos' },
          { id: 72, name: 'Accesos vasculares: definición y tipos' },
          { id: 73, name: 'Valoración y cuidados al paciente ostomizado' },
          { id: 74, name: 'Calidad asistencial y mejora continua' },
          { id: 75, name: 'Plan de Humanización del SSPA' },
          { id: 76, name: 'Seguridad del paciente (I): identificación de eventos adversos' },
          { id: 77, name: 'Seguridad del paciente (II): cultura de seguridad' },
          { id: 78, name: 'Cuidados paliativos: atención al paciente y familia en fase terminal' },
          { id: 79, name: 'Duelo: tipos, fases y cuidados enfermeros' },
        ],
      },
    ],
    totalTopics: 79,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/enfermero-sas-andalucia', label: 'Mi Oposición', icon: '🏥', featured: true },
      { href: '/enfermero-sas-andalucia/temario', label: 'Temario', icon: '📚' },
      { href: '/enfermero-sas-andalucia/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // TCAE SERMAS MADRID (C2)
  // ========================================
  {
    id: 'tcae_sermas_madrid',
    slug: 'tcae-sermas-madrid',
    positionType: 'tcae_sermas_madrid',
    name: 'TCAE del Servicio Madrileño de Salud (SERMAS)',
    shortName: 'TCAE SERMAS',
    emoji: '🏥',
    badge: 'C2',
    color: 'red',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1', title: 'Parte Común', subtitle: 'Legislación sanitaria, igualdad y PRL', icon: '⚖️',
        themes: [
          { id: 1, name: 'Derecho a la salud en la CE y Ley General de Sanidad. Ley 41/2002' },
          { id: 2, name: 'Profesiones sanitarias (Ley 44/2003) y Estatuto Marco (Ley 55/2003)' },
          { id: 3, name: 'Estructura Sanitaria de Madrid: LOSCAM y SERMAS' },
          { id: 4, name: 'Igualdad y violencia de género: normativa estatal y madrileña' },
          { id: 5, name: 'Prevención de riesgos laborales (Ley 31/1995)' },
          { id: 6, name: 'Protección de datos (LO 3/2018)' },
          { id: 7, name: 'Bioética y secreto profesional' },
          { id: 8, name: 'Trabajo en equipo multidisciplinar' },
          { id: 9, name: 'Comunicación con el paciente y relación de ayuda' },
        ],
      },
      {
        id: 'bloque2', title: 'Parte Específica', subtitle: 'Cuidados auxiliares de enfermería', icon: '🏥',
        themes: [
          { id: 10, name: 'Actividades del TCAE en Atención Primaria y Hospitalaria' },
          { id: 11, name: 'Archivo y documentación sanitaria. Consentimiento informado' },
          { id: 12, name: 'Higiene del paciente: baño, piel y capilar' },
          { id: 13, name: 'Paciente encamado: posiciones, camas, cambios posturales' },
          { id: 14, name: 'Persona anciana: envejecimiento y demencia' },
          { id: 15, name: 'Preparación del paciente quirúrgico' },
          { id: 16, name: 'Constantes vitales y balance hídrico' },
          { id: 17, name: 'Eliminación: sondajes, ostomías y enemas' },
          { id: 18, name: 'Recogida de muestras biológicas' },
          { id: 19, name: 'Gestión de residuos sanitarios y citostáticos' },
          { id: 20, name: 'Alimentación: dietas y nutrición enteral' },
          { id: 21, name: 'Medicamentos: tipos, vías de administración y conservación' },
          { id: 22, name: 'Oxigenoterapia: métodos y precauciones' },
          { id: 23, name: 'Aplicación local de frío y calor' },
          { id: 24, name: 'Higiene centros sanitarios: esterilización y desinfección' },
          { id: 25, name: 'Infecciones nosocomiales: aislamiento y lavado de manos' },
          { id: 26, name: 'Paciente terminal: duelo y cuidados post mortem' },
          { id: 27, name: 'Salud mental y toxicomanías' },
          { id: 28, name: 'Úlceras por presión: prevención y cuidados' },
          { id: 29, name: 'Mujer gestante: alimentación, higiene y reposo' },
          { id: 30, name: 'Urgencias y emergencias: primeros auxilios y RCP básica' },
        ],
      },
    ],
    totalTopics: 30,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/tcae-sermas-madrid', label: 'Mi Oposición', icon: '🏥', featured: true },
      { href: '/tcae-sermas-madrid/temario', label: 'Temario', icon: '📚' },
      { href: '/tcae-sermas-madrid/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // TCAE ARAGÓN (C2)
  // ========================================
  {
    id: 'tcae_aragon',
    slug: 'tcae-aragon',
    positionType: 'tcae_aragon',
    name: 'TCAE del Servicio Aragonés de Salud',
    shortName: 'TCAE Aragón',
    emoji: '🏥',
    badge: 'C2',
    color: 'red',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1', title: 'Parte General', subtitle: 'Legislación y organización sanitaria', icon: '⚖️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'La Corona, Cortes, Gobierno y organización territorial' },
          { id: 3, name: 'El Estatuto de Autonomía de Aragón' },
          { id: 4, name: 'Población, geografía y economía de Aragón' },
          { id: 5, name: 'Igualdad y violencia de género en Aragón' },
          { id: 6, name: 'Ley General de Sanidad y Ley de Salud de Aragón' },
          { id: 7, name: 'Estructura del Servicio Aragonés de Salud' },
          { id: 8, name: 'Procedimiento Administrativo Común' },
          { id: 9, name: 'Personal estatutario y empleado público' },
          { id: 10, name: 'Prevención de Riesgos Laborales' },
        ],
      },
      {
        id: 'bloque2', title: 'Parte Específica', subtitle: 'Cuidados auxiliares de enfermería', icon: '🏥',
        themes: [
          { id: 11, name: 'Salud laboral: riesgos biológicos, químicos y físicos' },
          { id: 12, name: 'Calidad en el SNS y seguridad clínica' },
          { id: 13, name: 'Gestión de residuos sanitarios' },
          { id: 14, name: 'Recogida y transporte de muestras biológicas' },
          { id: 15, name: 'Trabajo en equipo y comunicación' },
          { id: 16, name: 'Infecciones nosocomiales y aislamiento' },
          { id: 17, name: 'Esterilización y desinfección' },
          { id: 18, name: 'Alimentación y nutrición' },
          { id: 19, name: 'Eliminación: sondajes y ostomías' },
          { id: 20, name: 'Movilización, traslado y deambulación' },
          { id: 21, name: 'Higiene del paciente' },
          { id: 22, name: 'Atención a la mujer gestante y recién nacido' },
          { id: 23, name: 'Constantes vitales y balance hídrico' },
          { id: 24, name: 'Urgencias, emergencias y RCP básica' },
          { id: 25, name: 'Medicamentos, termoterapia y oxigenoterapia' },
          { id: 26, name: 'Paciente encamado y úlceras por presión' },
          { id: 27, name: 'Paciente quirúrgico' },
          { id: 28, name: 'Plan de Salud Mental en Aragón' },
          { id: 29, name: 'Atención a la persona anciana' },
          { id: 30, name: 'Paciente terminal y cuidados paliativos' },
        ],
      },
    ],
    totalTopics: 30,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/tcae-aragon', label: 'Mi Oposición', icon: '🏥', featured: true },
      { href: '/tcae-aragon/temario', label: 'Temario', icon: '📚' },
      { href: '/tcae-aragon/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // AUXILIAR ENFERMERÍA GVA (C2)
  // ========================================
  {
    id: 'auxiliar_enfermeria_gva',
    slug: 'auxiliar-enfermeria-gva',
    positionType: 'auxiliar_enfermeria_gva',
    name: 'Auxiliar de Enfermería de la Generalitat Valenciana (C2-03-03)',
    shortName: 'Aux Enfermería GVA',
    emoji: '🏥',
    badge: 'C2',
    color: 'orange',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1', title: 'Parte General', subtitle: 'Legislación y derecho administrativo', icon: '⚖️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Estatuto de Autonomía de la Comunitat Valenciana' },
          { id: 3, name: 'Ley del Consell (I)' },
          { id: 4, name: 'Ley del Consell (II)' },
          { id: 5, name: 'Régimen Jurídico del Sector Público' },
          { id: 6, name: 'Procedimiento Administrativo Común' },
          { id: 7, name: 'Función Pública Valenciana' },
          { id: 8, name: 'Condiciones de trabajo del personal funcionario GVA' },
          { id: 9, name: 'Prevención de Riesgos Laborales' },
          { id: 10, name: 'Igualdad, violencia de género y LGTBI' },
        ],
      },
      {
        id: 'bloque2', title: 'Parte Especial I: AICP', subtitle: 'Atención integral centrada en la persona', icon: '🤝',
        themes: [
          { id: 11, name: 'Modelo AICP: Atención integral centrada en la persona' },
          { id: 12, name: 'Funciones del auxiliar de enfermería' },
          { id: 13, name: 'Comunicación y trabajo en equipo' },
          { id: 14, name: 'Bioética y buen trato' },
          { id: 15, name: 'Atención a personas con deterioro cognitivo' },
          { id: 16, name: 'Medidas restrictivas y sujeciones' },
        ],
      },
      {
        id: 'bloque3', title: 'Parte Especial II: Cuidados', subtitle: 'Cuidados auxiliares de enfermería', icon: '🏥',
        themes: [
          { id: 17, name: 'Limpieza, desinfección y esterilización' },
          { id: 18, name: 'Posiciones y mecánica corporal' },
          { id: 19, name: 'Urgencias, RCP y oxigenoterapia' },
          { id: 20, name: 'Alimentación y nutrición' },
          { id: 21, name: 'Higiene del paciente y úlceras por presión' },
          { id: 22, name: 'Cuidados del aparato urinario' },
          { id: 23, name: 'Cuidados paliativos' },
          { id: 24, name: 'Documentación sanitaria y protección de datos' },
        ],
      },
    ],
    totalTopics: 24,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-enfermeria-gva', label: 'Mi Oposición', icon: '🏥', featured: true },
      { href: '/auxiliar-enfermeria-gva/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-enfermeria-gva/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // TCAE CANARIAS (C2)
  // ========================================
  {
    id: 'tcae_canarias',
    slug: 'tcae-canarias',
    positionType: 'tcae_canarias',
    name: 'TCAE del Servicio Canario de Salud',
    shortName: 'TCAE Canarias',
    emoji: '🏥',
    badge: 'C2',
    color: 'yellow',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1', title: 'Programa', subtitle: 'Cuidados auxiliares de enfermería (100% clínico)', icon: '🏥',
        themes: [
          { id: 1, name: 'Prevención de Riesgos Laborales' },
          { id: 2, name: 'Funciones del TCAE en AP y Especializada' },
          { id: 3, name: 'Higiene del paciente' },
          { id: 4, name: 'Paciente encamado: posiciones, camas y movilización' },
          { id: 5, name: 'Preparación del paciente quirúrgico' },
          { id: 6, name: 'Constantes vitales y balance hídrico' },
          { id: 7, name: 'Vigilancia del enfermo' },
          { id: 8, name: 'Eliminación, muestras, sondajes y ostomías' },
          { id: 9, name: 'Muestras biológicas y residuos sanitarios' },
          { id: 10, name: 'Alimentación y nutrición' },
          { id: 11, name: 'Medicamentos: vías de administración' },
          { id: 12, name: 'Aplicación local de frío y calor' },
          { id: 13, name: 'Oxigenoterapia' },
          { id: 14, name: 'Higiene de centros sanitarios e infección hospitalaria' },
          { id: 15, name: 'Infección, desinfección, asepsia y antisepsia' },
          { id: 16, name: 'Esterilización' },
          { id: 17, name: 'Cuidados de la mujer gestante' },
          { id: 18, name: 'Atención al recién nacido y lactante' },
          { id: 19, name: 'Atención a pacientes con traumatismos' },
          { id: 20, name: 'Paciente terminal, salud mental y geriatría' },
          { id: 21, name: 'Úlceras por presión' },
          { id: 22, name: 'Urgencias, emergencias y RCP' },
          { id: 23, name: 'Salud laboral, ergonomía y movilización' },
          { id: 24, name: 'Documentación sanitaria' },
        ],
      },
    ],
    totalTopics: 24,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/tcae-canarias', label: 'Mi Oposición', icon: '🏥', featured: true },
      { href: '/tcae-canarias/temario', label: 'Temario', icon: '📚' },
      { href: '/tcae-canarias/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // TCAE GALICIA (C2)
  // ========================================
  {
    id: 'tcae_galicia',
    slug: 'tcae-galicia',
    positionType: 'tcae_galicia',
    name: 'TCAE del Servicio Gallego de Salud (SERGAS)',
    shortName: 'TCAE Galicia',
    emoji: '🏥',
    badge: 'C2',
    color: 'blue',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1', title: 'Parte Común', subtitle: 'Legislación y organización sanitaria', icon: '⚖️',
        themes: [
          { id: 1, name: 'La Constitución Española' },
          { id: 2, name: 'Estatuto de Autonomía de Galicia' },
          { id: 3, name: 'Ley General de Sanidad' },
          { id: 4, name: 'Ley de Salud de Galicia y SERGAS' },
          { id: 5, name: 'Estatuto Marco' },
          { id: 6, name: 'Personal estatutario del SERGAS' },
          { id: 7, name: 'Protección de datos y consentimiento informado' },
          { id: 8, name: 'PRL, violencia de género e igualdad' },
        ],
      },
      {
        id: 'bloque2', title: 'Parte Específica', subtitle: 'Cuidados auxiliares de enfermería', icon: '🏥',
        themes: [
          { id: 9, name: 'Calidad en el sistema sanitario' },
          { id: 10, name: 'Actividades del TCAE' },
          { id: 11, name: 'Documentación sanitaria y bioética' },
          { id: 12, name: 'Prevención, promoción e inmunizaciones' },
          { id: 13, name: 'Comunicación y trabajo en equipo' },
          { id: 14, name: 'Nociones básicas de informática' },
          { id: 15, name: 'Higiene del paciente' },
          { id: 16, name: 'Paciente encamado: posiciones y movilización' },
          { id: 17, name: 'Preparación del paciente quirúrgico' },
          { id: 18, name: 'Constantes vitales' },
          { id: 19, name: 'Eliminación, muestras, sondajes y ostomías' },
          { id: 20, name: 'Muestras biológicas y residuos sanitarios' },
          { id: 21, name: 'Alimentación y nutrición' },
          { id: 22, name: 'Medicamentos y oxigenoterapia' },
          { id: 23, name: 'Higiene de centros sanitarios y aislamiento' },
          { id: 24, name: 'Infección, desinfección y esterilización' },
          { id: 25, name: 'Paciente terminal y cuidados post mortem' },
          { id: 26, name: 'Úlceras por presión' },
          { id: 27, name: 'Urgencias, emergencias y RCP' },
          { id: 28, name: 'Salud mental y toxicomanías' },
          { id: 29, name: 'Atención a la persona anciana' },
          { id: 30, name: 'Frío y calor' },
          { id: 31, name: 'Perspectiva de género en salud' },
        ],
      },
    ],
    totalTopics: 31,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/tcae-galicia', label: 'Mi Oposición', icon: '🏥', featured: true },
      { href: '/tcae-galicia/temario', label: 'Temario', icon: '📚' },
      { href: '/tcae-galicia/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // TCAE MURCIA (C2)
  // ========================================
  {
    id: 'tcae_murcia',
    slug: 'tcae-murcia',
    positionType: 'tcae_murcia',
    name: 'TCAE del Servicio Murciano de Salud (SMS)',
    shortName: 'TCAE Murcia',
    emoji: '🏥',
    badge: 'C2',
    color: 'purple',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1', title: 'Parte General', subtitle: 'Legislación sanitaria', icon: '⚖️',
        themes: [
          { id: 1, name: 'La Constitución Española y Estatuto de Autonomía de Murcia' },
          { id: 2, name: 'Ley General de Sanidad y ordenación sanitaria de Murcia' },
          { id: 3, name: 'Derechos y deberes de los usuarios del SMS' },
          { id: 4, name: 'Personal estatutario del SMS y Estatuto Marco' },
          { id: 5, name: 'Prevención de Riesgos Laborales' },
          { id: 6, name: 'Transparencia y protección de datos' },
          { id: 7, name: 'Igualdad y violencia de género' },
        ],
      },
      {
        id: 'bloque2', title: 'Parte Específica', subtitle: 'Cuidados auxiliares de enfermería', icon: '🏥',
        themes: Array.from({length:37}, (_,i) => {
          const titles = ['Atención primaria y actividades del TCAE','El hospital: organización y seguridad','Documentación sanitaria y consentimiento informado','Bioética y secreto profesional','Comunicación y trabajo en equipo','Cuidados básicos y necesidades del paciente','Higiene del paciente encamado','Paciente encamado: camas y posiciones','Posiciones, cambios posturales y movilización','Constantes vitales y balance hídrico','Úlceras por presión y cuidados de la piel','Muestras biológicas','Gestión de residuos sanitarios','Eliminación: sondajes y ostomías','Preparación del paciente quirúrgico','Alimentación y nutrición enteral','Medicamentos y vías de administración','Aplicación local de frío y calor','Oxigenoterapia y aparato respiratorio','Nefrología y urología','Traumatología: vendajes y férulas','Hematología y grupos sanguíneos','Digestivo y endoscopias','Inmunología, vacunas e infecciones nosocomiales','Atención a la persona anciana','Paciente terminal y cuidados paliativos','Toxicomanías y Plan Regional de Adicciones','El TCAE en el quirófano','Urgencias, emergencias y RCP básica','Esterilización y desinfección','Almacenes y materiales sanitarios','Salud laboral y ergonomía','Seguridad del paciente y calidad de cuidados','Formación continuada y docencia','Salud mental','Atención a la mujer gestante','Atención al recién nacido y pediatría'];
          return { id: i+8, name: titles[i] };
        }),
      },
    ],
    totalTopics: 44,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/tcae-murcia', label: 'Mi Oposición', icon: '🏥', featured: true },
      { href: '/tcae-murcia/temario', label: 'Temario', icon: '📚' },
      { href: '/tcae-murcia/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // CELADOR SERMAS MADRID (E)
  // ========================================
  {
    id: 'celador_sermas_madrid',
    slug: 'celador-sermas-madrid',
    positionType: 'celador_sermas_madrid',
    name: 'Celador del Servicio Madrileño de Salud (SERMAS)',
    shortName: 'Celador SERMAS',
    emoji: '🏥',
    badge: 'E',
    color: 'blue',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1', title: 'Parte Común', subtitle: 'Legislación sanitaria y derechos', icon: '⚖️',
        themes: [
          { id: 1, name: 'Derecho a la salud. Estatuto de Autonomía de Madrid' },
          { id: 2, name: 'Ley General de Sanidad: SNS y áreas de salud' },
          { id: 3, name: 'Asistencia sanitaria: Atención Primaria y Hospitalaria' },
          { id: 4, name: 'LOSCAM: derechos y deberes de los ciudadanos' },
          { id: 5, name: 'Igualdad, violencia de género y LGTBfobia' },
          { id: 6, name: 'Buen Gobierno del SERMAS (Ley 11/2017)' },
          { id: 7, name: 'Autonomía del paciente (Ley 41/2002)' },
          { id: 8, name: 'Estatuto Marco (Ley 55/2003)' },
          { id: 9, name: 'PRL: riesgo biológico, cargas y ergonomía' },
        ],
      },
      {
        id: 'bloque2', title: 'Parte Específica', subtitle: 'Funciones del celador', icon: '🏥',
        themes: [
          { id: 10, name: 'Funciones del celador: vigilancia y apoyo' },
          { id: 11, name: 'Celador en hospitalización, quirófano, UCI y urgencias' },
          { id: 12, name: 'Celador en Atención Primaria y consultas externas' },
          { id: 13, name: 'Trabajo en equipo y posiciones anatómicas' },
          { id: 14, name: 'Farmacia, mortuorio y almacenaje' },
          { id: 15, name: 'Movilización de pacientes: técnicas de traslado' },
          { id: 16, name: 'Documentación clínica y confidencialidad' },
        ],
      },
    ],
    totalTopics: 16,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/celador-sermas-madrid', label: 'Mi Oposición', icon: '🏥', featured: true },
      { href: '/celador-sermas-madrid/temario', label: 'Temario', icon: '📚' },
      { href: '/celador-sermas-madrid/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // CELADOR SCS CANARIAS (E)
  // ========================================
  {
    id: 'celador_scs_canarias',
    slug: 'celador-scs-canarias',
    positionType: 'celador_scs_canarias',
    name: 'Celador/a del Servicio Canario de Salud (SCS)',
    shortName: 'Celador SCS',
    emoji: '🏥',
    badge: 'E',
    color: 'teal',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1', title: 'Temario Oficial', subtitle: 'Funciones del celador en el SCS', icon: '🏥',
        themes: [
          { id: 1, name: 'Atención al usuario y tarjeta sanitaria' },
          { id: 2, name: 'Funciones del Celador y del Jefe de Personal Subalterno' },
          { id: 3, name: 'Admisión, vigilancia y actuación con familiares' },
          { id: 4, name: 'Movilización y traslado de pacientes' },
          { id: 5, name: 'Quirófanos: normas de higiene y esterilización' },
          { id: 6, name: 'Pacientes fallecidos, autopsias y mortuorio' },
          { id: 7, name: 'Suministros: recepción, almacén y distribución' },
          { id: 8, name: 'Celador en farmacia y animalario' },
          { id: 9, name: 'Traslado de documentos y documentación sanitaria' },
          { id: 10, name: 'Psiquiatría: enfermo mental y urgencias psiquiátricas' },
          { id: 11, name: 'Emergencias: métodos de traslado y plan de catástrofes' },
          { id: 12, name: 'Enfermo contagioso: tipos de aislamientos' },
          { id: 13, name: 'Celador en urgencias y transporte en ambulancias' },
          { id: 14, name: 'Material de transporte sanitario' },
        ],
      },
    ],
    totalTopics: 14,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/celador-scs-canarias', label: 'Mi Oposición', icon: '🏥', featured: true },
      { href: '/celador-scs-canarias/temario', label: 'Temario', icon: '📚' },
      { href: '/celador-scs-canarias/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // CELADOR SESCAM CLM (E)
  // ========================================
  {
    id: 'celador_sescam_clm',
    slug: 'celador-sescam-clm',
    positionType: 'celador_sescam_clm',
    name: 'Celador/a del SESCAM (Castilla-La Mancha)',
    shortName: 'Celador SESCAM',
    emoji: '🏥',
    badge: 'E',
    color: 'red',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1', title: 'Parte Común', subtitle: 'Legislación y sistema sanitario', icon: '⚖️',
        themes: [
          { id: 1, name: 'CE: derechos fundamentales, salud e igualdad' },
          { id: 2, name: 'Estatuto de Autonomía de CLM y Administración autonómica' },
          { id: 3, name: 'Ley General de Sanidad: SNS y áreas de salud' },
          { id: 4, name: 'Ordenación sanitaria CLM y estructura del SESCAM' },
          { id: 5, name: 'Estatuto Marco (I): normas generales, clasificación y derechos' },
          { id: 6, name: 'Estatuto Marco (II): provisión, selección y carrera profesional' },
          { id: 7, name: 'Estatuto Marco (III): retribuciones, jornada y régimen disciplinario' },
          { id: 8, name: 'PRL: derechos, obligaciones y Plan Perseo' },
          { id: 9, name: 'Atención primaria: zona básica, equipos y urgencias' },
          { id: 10, name: 'Asistencia especializada: hospitales y centros' },
          { id: 11, name: 'Derechos del usuario, tarjeta sanitaria y documentación clínica' },
        ],
      },
      {
        id: 'bloque2', title: 'Parte Específica', subtitle: 'Funciones del celador', icon: '🏥',
        themes: [
          { id: 12, name: 'Funciones del Celador: vigilancia, asistencia y aseo' },
          { id: 13, name: 'Movilización de pacientes: técnicas y material auxiliar' },
          { id: 14, name: 'Quirófanos, urgencias y primeros auxilios' },
          { id: 15, name: 'Pacientes fallecidos, autopsias y mortuorio' },
        ],
      },
    ],
    totalTopics: 15,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/celador-sescam-clm', label: 'Mi Oposición', icon: '🏥', featured: true },
      { href: '/celador-sescam-clm/temario', label: 'Temario', icon: '📚' },
      { href: '/celador-sescam-clm/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // AUXILIAR DE ENFERMERÍA OSAKIDETZA (TCAE) - PAÍS VASCO (C2)
  // ========================================
  {
    id: 'auxiliar_enfermeria_osakidetza',
    slug: 'auxiliar-enfermeria-osakidetza',
    positionType: 'auxiliar_enfermeria_osakidetza',
    name: 'Auxiliar de Enfermería Osakidetza (TCAE) — Servicio Vasco de Salud',
    shortName: 'TCAE Osakidetza',
    emoji: '🩺',
    badge: 'C2',
    color: 'teal',
    administracion: 'autonomica',
    blocks: [
      {
        id: 'bloque1', title: 'Temario Común', subtitle: 'Legislación sanitaria y marco autonómico vasco', icon: '⚖️',
        themes: [
          { id: 1, name: 'Ordenación de las profesiones sanitarias' },
          { id: 2, name: 'Cohesión y calidad del Sistema Nacional de Salud' },
          { id: 3, name: 'Estatuto Marco del personal estatutario de los servicios de salud' },
          { id: 4, name: 'Ordenación Sanitaria de Euskadi' },
          { id: 5, name: 'Estatutos Sociales del Ente Público Osakidetza' },
          { id: 6, name: 'Organizaciones sanitarias integradas de Osakidetza' },
          { id: 7, name: 'Derechos y Deberes de las personas en el sistema sanitario de Euskadi' },
          { id: 8, name: 'Autonomía del paciente' },
          { id: 9, name: 'Voluntades anticipadas en el ámbito de la sanidad' },
          { id: 10, name: 'Protección de Datos Personales y garantía de los derechos digitales' },
          { id: 11, name: 'Igualdad de Mujeres y Hombres y Vidas Libres de Violencia Machista' },
          { id: 12, name: 'Plan de Salud de Euskadi 2030' },
          { id: 13, name: 'Pacto Vasco de Salud' },
          { id: 14, name: 'Estrategia de Seguridad del Paciente en Osakidetza 2030' },
          { id: 15, name: 'II Plan para la Igualdad de mujeres y hombres en Osakidetza 2025-2028' },
          { id: 16, name: 'III Plan de Normalización del Uso del Euskera en Osakidetza' },
          { id: 17, name: 'Plan Oncológico Integral de Euskadi 2025-2030' },
          { id: 18, name: 'Regulación de la eutanasia' },
          { id: 19, name: 'Incompatibilidades del personal al servicio de las Administraciones Públicas' },
        ],
      },
      {
        id: 'bloque2', title: 'Temario Específico', subtitle: 'Cuidados auxiliares de enfermería', icon: '🩺',
        themes: [
          { id: 101, displayNumber: 1, name: 'Estructura del sistema sanitario y documentos clínicos' },
          { id: 102, displayNumber: 2, name: 'Salud pública y salud comunitaria' },
          { id: 103, displayNumber: 3, name: 'Proceso de atención de enfermería (PAE)' },
          { id: 104, displayNumber: 4, name: 'Principios fundamentales de bioética' },
          { id: 105, displayNumber: 5, name: 'Almacenamiento y control de materiales' },
          { id: 106, displayNumber: 6, name: 'Higiene del paciente. Piel y mucosas. LCRD' },
          { id: 107, displayNumber: 7, name: 'Movilización, deambulación e higiene postural' },
          { id: 108, displayNumber: 8, name: 'Aparato cardiovascular y respiratorio. Constantes vitales' },
          { id: 109, displayNumber: 9, name: 'Administración de medicación. Farmacología general' },
          { id: 110, displayNumber: 10, name: 'Aerosolterapia y oxigenoterapia' },
          { id: 111, displayNumber: 11, name: 'Aparato digestivo. Alimentación y nutrición' },
          { id: 112, displayNumber: 12, name: 'Aparato urinario. Eliminación urinaria y sondajes' },
          { id: 113, displayNumber: 13, name: 'Cuidados post mortem' },
          { id: 114, displayNumber: 14, name: 'Primeros auxilios y RCP' },
          { id: 115, displayNumber: 15, name: 'Cuidados en las distintas etapas del ciclo vital' },
          { id: 116, displayNumber: 16, name: 'Limpieza, desinfección y esterilización' },
          { id: 117, displayNumber: 17, name: 'Infecciones. Aislamiento y precauciones' },
          { id: 118, displayNumber: 18, name: 'Manipulación de muestras y residuos sanitarios' },
          { id: 119, displayNumber: 19, name: 'Fundamentos de psicología general y evolutiva' },
          { id: 120, displayNumber: 20, name: 'Comunicación y humanización' },
          { id: 121, displayNumber: 21, name: 'Salud y enfermedad. Influencia del medio' },
          { id: 122, displayNumber: 22, name: 'El auxiliar de enfermería en equipo multidisciplinar' },
          { id: 123, displayNumber: 23, name: 'Estados psicológicos de los pacientes en situaciones especiales' },
          { id: 124, displayNumber: 24, name: 'Educación sanitaria y promoción de la salud' },
          { id: 125, displayNumber: 25, name: 'Salud mental. Trastornos psíquicos' },
          { id: 126, displayNumber: 26, name: 'Seguridad clínica del paciente' },
          { id: 127, displayNumber: 27, name: 'Salud Laboral. Condiciones físico-ambientales del trabajo' },
          { id: 128, displayNumber: 28, name: 'Vías de administración de medicamentos' },
          { id: 129, displayNumber: 29, name: 'Violencia de género. Protocolo de actuación' },
          { id: 130, displayNumber: 30, name: 'Buenas prácticas y evidencia científica' },
        ],
      },
    ],
    totalTopics: 49,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-enfermeria-osakidetza', label: 'Mi Oposición', icon: '🩺', featured: true },
      { href: '/auxiliar-enfermeria-osakidetza/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-enfermeria-osakidetza/test', label: 'Tests', icon: '🎯' },
    ],
  },
  // ========================================
  // GUARDIA CIVIL - ESCALA CABOS Y GUARDIAS (C1 por Ley 29/2014, acceso con ESO)
  // ========================================
  {
    id: 'guardia_civil',
    slug: 'guardia-civil',
    positionType: 'guardia_civil',
    name: 'Guardia Civil - Escala de Cabos y Guardias',
    shortName: 'Guardia Civil',
    emoji: '🛡️',
    badge: 'C1',
    color: 'green',
    administracion: 'estado',
    blocks: [
      {
        id: 'conocimientos', title: 'Conocimientos', subtitle: '23 temas — 100 preguntas en el examen', icon: '⚖️',
        themes: [
          { id: 1, name: 'Derechos Humanos: ONU, Convenios y Carta de la UE' },
          { id: 2, name: 'Igualdad efectiva de mujeres y hombres (LO 3/2007)' },
          { id: 3, name: 'Prevención de riesgos laborales (Ley 31/1995)' },
          { id: 4, name: 'Derecho Constitucional: CE, Defensor del Pueblo, honor e intimidad' },
          { id: 5, name: 'Derecho de la Unión Europea: TUE y TFUE' },
          { id: 6, name: 'Instituciones internacionales: ONU, OTAN, EUROPOL, FRONTEX' },
          { id: 7, name: 'Derecho Civil: Código Civil, Título Preliminar y personas' },
          { id: 8, name: 'Derecho Penal: Código Penal, penas, delitos principales' },
          { id: 9, name: 'Derecho Procesal Penal: LECrim, Habeas Corpus, Policía Judicial' },
          { id: 10, name: 'Derecho Administrativo: Ley 39/2015 y Ley 40/2015' },
          { id: 11, name: 'Protección de datos (LO 3/2018)' },
          { id: 12, name: 'Extranjería e inmigración (LO 4/2000)' },
          { id: 13, name: 'Seguridad pública y seguridad privada' },
          { id: 14, name: 'Ministerio del Interior y Ministerio de Defensa' },
          { id: 15, name: 'Fuerzas y Cuerpos de Seguridad. La Guardia Civil' },
          { id: 16, name: 'Protección civil, patrimonio natural y eficiencia energética' },
          { id: 17, name: 'TIC: telecomunicaciones, firma digital y ciberseguridad' },
          { id: 18, name: 'Topografía: coordenadas, escalas y representación del terreno' },
          { id: 19, name: 'Deontología profesional: uso de la fuerza y código de conducta' },
          { id: 20, name: 'Responsabilidad penal de los menores (LO 5/2000)' },
          { id: 21, name: 'Violencia de género (LO 1/2004)' },
          { id: 22, name: 'Armas y explosivos: reglamentos' },
          { id: 23, name: 'Derecho fiscal: contrabando y Código Aduanero de la UE' },
        ],
      },
      {
        id: 'ingles', title: 'Lengua Inglesa', subtitle: '20 preguntas en el examen', icon: '🇬🇧',
        themes: [
          { id: 24, name: 'Inglés: comprensión lectora y ortografía' },
        ],
      },
      {
        id: 'lengua', title: 'Lengua Española', subtitle: 'Ortografía y gramática', icon: '📝',
        themes: [
          { id: 25, name: 'Lengua española: ortografía y gramática' },
        ],
      },
    ],
    totalTopics: 25,
    aliases: ['guardia civil', 'benemérita', 'guardia', 'cabos y guardias', 'escala cabos', 'oposicion guardia', 'oposiciones guardia civil'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/guardia-civil', label: 'Mi Oposición', icon: '🛡️', featured: true },
      { href: '/guardia-civil/temario', label: 'Temario', icon: '📚' },
      { href: '/guardia-civil/test', label: 'Tests', icon: '🎯' },
    ],
    hasSpellingTest: true,
    hasPsychometricTest: true,
    officialExams: [
      // Convocatorias Cabos y Guardias — más recientes primero
      {
        date: '2025-09-06',
        title: 'Convocatoria 6 de septiembre de 2025',
        oep: 'OEP 2024-2025',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2024-10-13',
        title: 'Convocatoria 13 de octubre de 2024 (llamamiento aplazado)',
        oep: 'OEP 2023-2024',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
        note: 'Llamamiento reprogramado tras suspensión del examen del 29/09/2024 por error logístico.',
      },
      {
        date: '2024-09-29',
        title: 'Convocatoria 29 de septiembre de 2024 (Domingo)',
        oep: 'OEP 2023-2024',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2024-09-28',
        title: 'Convocatoria 28 de septiembre de 2024 (Sábado)',
        oep: 'OEP 2023-2024',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2023-10-29',
        title: 'Convocatoria 29 de octubre de 2023 (Domingo)',
        oep: 'OEP 2022-2023',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2023-10-28',
        title: 'Convocatoria 28 de octubre de 2023 (Sábado)',
        oep: 'OEP 2022-2023',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2022-10-15',
        title: 'Convocatoria 15 de octubre de 2022 (Canarias)',
        oep: 'OEP 2021-2022',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
        note: 'Llamamiento aplazado para sede de Canarias.',
      },
      {
        date: '2022-09-25',
        title: 'Convocatoria 25 de septiembre de 2022 (Domingo)',
        oep: 'OEP 2021-2022',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2022-09-24',
        title: 'Convocatoria 24 de septiembre de 2022 (Sábado)',
        oep: 'OEP 2021-2022',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2021-09-26',
        title: 'Convocatoria 26 de septiembre de 2021 (Domingo)',
        oep: 'OEP 2020-2021',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2021-09-25',
        title: 'Convocatoria 25 de septiembre de 2021 (Sábado)',
        oep: 'OEP 2020-2021',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2020-10-25',
        title: 'Convocatoria 25 de octubre de 2020 (Domingo)',
        oep: 'OEP 2019-2020',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
        note: 'Aplazado por la pandemia COVID-19.',
      },
      {
        date: '2020-10-24',
        title: 'Convocatoria 24 de octubre de 2020 (Sábado)',
        oep: 'OEP 2019-2020',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
        note: 'Aplazado por la pandemia COVID-19.',
      },
      {
        date: '2019-07-14',
        title: 'Convocatoria 14 de julio de 2019 (Domingo)',
        oep: 'OEP 2018-2019',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2019-07-13',
        title: 'Convocatoria 13 de julio de 2019 (Sábado)',
        oep: 'OEP 2018-2019',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2018-07-08',
        title: 'Convocatoria 8 de julio de 2018 (Domingo)',
        oep: 'OEP 2017-2018',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2018-07-07',
        title: 'Convocatoria 7 de julio de 2018 (Sábado)',
        oep: 'OEP 2017-2018',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2017-07-09',
        title: 'Convocatoria 9 de julio de 2017 (Domingo)',
        oep: 'OEP 2016-2017',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2017-07-08',
        title: 'Convocatoria 8 de julio de 2017 (Sábado)',
        oep: 'OEP 2016-2017',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2016-07-10',
        title: 'Convocatoria 10 de julio de 2016 (Domingo)',
        oep: 'OEP 2015-2016',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2016-07-09',
        title: 'Convocatoria 9 de julio de 2016 (Sábado)',
        oep: 'OEP 2015-2016',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo (25 temas)' },
        ],
      },
      {
        date: '2015-09-12',
        title: 'Convocatoria 12 de septiembre de 2015',
        oep: 'OEP 2015',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2014-09-06',
        title: 'Convocatoria 6 de septiembre de 2014',
        oep: 'OEP 2014',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2013-09-14',
        title: 'Convocatoria 14 de septiembre de 2013',
        oep: 'OEP 2013',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2013-01-12',
        title: 'Convocatoria 12 de enero de 2013',
        oep: 'OEP 2012',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
        note: 'Convocatoria 2012, examen celebrado en enero 2013.',
      },
      {
        date: '2011-06-25',
        title: 'Convocatoria 25 de junio de 2011',
        oep: 'OEP 2011',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2010-09-04',
        title: 'Convocatoria 4 de septiembre de 2010',
        oep: 'OEP 2010',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2009-07-11',
        title: 'Convocatoria 11 de julio de 2009',
        oep: 'OEP 2009',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2008-11-16',
        title: 'Convocatoria 16 de noviembre de 2008 (2ª convocatoria)',
        oep: 'OEP 2008',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2008-06-14',
        title: 'Convocatoria 14 de junio de 2008 (1ª convocatoria)',
        oep: 'OEP 2008',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2007-12-15',
        title: 'Convocatoria 15 de diciembre de 2007',
        oep: 'OEP 2007',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2006-06-10',
        title: 'Convocatoria 10 de junio de 2006',
        oep: 'OEP 2006',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2005-11-12',
        title: 'Convocatoria 12 de noviembre de 2005 (2ª convocatoria)',
        oep: 'OEP 2005',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2005-07-09',
        title: 'Convocatoria 9 de julio de 2005 (1ª convocatoria)',
        oep: 'OEP 2005',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2004-06-22',
        title: 'Convocatoria 22 de junio de 2004',
        oep: 'OEP 2004',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2003-07-23',
        title: 'Convocatoria 23 de julio de 2003',
        oep: 'OEP 2003',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2002-06-25',
        title: 'Convocatoria 25 de junio de 2002',
        oep: 'OEP 2002',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2001-07-26',
        title: 'Convocatoria 26 de julio de 2001',
        oep: 'OEP 2001',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      {
        date: '2000-06-28',
        title: 'Convocatoria 28 de junio de 2000',
        oep: 'OEP 2000',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Temario completo' },
        ],
      },
      // Convocatorias Colegio de Guardias Jóvenes
      {
        date: '2025-08-28',
        title: 'Guardias Jóvenes — Convocatoria 28 de agosto de 2025',
        oep: 'Colegio Guardias Jóvenes 2025',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Acceso al Colegio de Guardias Jóvenes' },
        ],
      },
      {
        date: '2024-08-29',
        title: 'Guardias Jóvenes — Convocatoria 29 de agosto de 2024',
        oep: 'Colegio Guardias Jóvenes 2024',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Acceso al Colegio de Guardias Jóvenes' },
        ],
      },
      {
        date: '2023-08-31',
        title: 'Guardias Jóvenes — Convocatoria de agosto de 2023',
        oep: 'Colegio Guardias Jóvenes 2023',
        partes: [
          { id: 'unica', icon: '📘', title: 'Conocimientos generales', description: 'Acceso al Colegio de Guardias Jóvenes' },
        ],
        note: 'Fecha estimada por patrón histórico (último jueves agosto). Pendiente confirmación BOGC.',
      },
    ],
  },
  // ========================================
  // POLICÍA NACIONAL - ESCALA BÁSICA (C1)
  // ========================================
  {
    id: 'policia_nacional',
    slug: 'policia-nacional',
    positionType: 'policia_nacional',
    name: 'Policía Nacional - Escala Básica',
    shortName: 'Policía Nacional',
    emoji: '👮',
    badge: 'C1',
    color: 'blue',
    administracion: 'estado',
    questionTag: 'PN',
    blocks: [
      { id: 'bloque1', title: 'Bloque A: Ciencias Jurídicas', subtitle: '26 temas de Derecho', icon: '⚖️',
        themes: [
          { id: 1, name: 'El Derecho: concepto y acepciones' },
          { id: 2, name: 'Constitución Española (I): estructura y principios' },
          { id: 3, name: 'Constitución Española (II): derechos y libertades' },
          { id: 4, name: 'La Unión Europea' },
          { id: 5, name: 'Organización y funcionamiento de la AGE' },
          { id: 6, name: 'Los funcionarios públicos' },
          { id: 7, name: 'El Ministerio del Interior' },
          { id: 8, name: 'La Dirección General de la Policía' },
          { id: 9, name: 'LO 2/1986 de Fuerzas y Cuerpos de Seguridad' },
          { id: 10, name: 'Entrada y libre circulación ciudadanos UE/EEE' },
          { id: 11, name: 'Infracciones extranjería y régimen sancionador' },
          { id: 12, name: 'Protección internacional (asilo y refugio)' },
          { id: 13, name: 'Seguridad privada' },
          { id: 14, name: 'LO 4/2015 de Seguridad Ciudadana' },
          { id: 15, name: 'Infraestructuras críticas' },
          { id: 16, name: 'Derecho Penal: parte general' },
          { id: 17, name: 'Derecho Penal: delitos contra las personas' },
          { id: 18, name: 'Delitos contra patrimonio y orden socioeconómico' },
          { id: 19, name: 'Delitos contra el orden público' },
          { id: 20, name: 'Delitos informáticos' },
          { id: 21, name: 'Derecho Procesal Penal' },
          { id: 22, name: 'Estatuto de la víctima del delito (Ley 4/2015)' },
          { id: 23, name: 'Igualdad, protección y no discriminación' },
          { id: 24, name: 'PRL: introducción' },
          { id: 25, name: 'PRL: marco normativo' },
          { id: 26, name: 'Protección de datos personales' },
        ] },
      { id: 'bloque2', title: 'Bloque B: Ciencias Sociales', subtitle: '11 temas', icon: '🌍',
        themes: [
          { id: 27, name: 'Derechos humanos' },
          { id: 28, name: 'Globalización y antiglobalización' },
          { id: 29, name: 'Actitudes y valores sociales' },
          { id: 30, name: 'Principios éticos de la sociedad actual' },
          { id: 31, name: 'Inmigración' },
          { id: 32, name: 'Geografía humana' },
          { id: 33, name: 'La seguridad' },
          { id: 34, name: 'Drogodependencias' },
          { id: 35, name: 'Desarrollo sostenible' },
          { id: 36, name: 'Gramática lengua española' },
          { id: 37, name: 'Ortografía lengua española' },
        ] },
      { id: 'bloque3', title: 'Bloque C: Ciencias Técnico-Científicas', subtitle: '8 temas', icon: '💻',
        themes: [
          { id: 38, name: 'Sistemas operativos' },
          { id: 39, name: 'Redes informáticas' },
          { id: 40, name: 'Inteligencia' },
          { id: 41, name: 'Ciberdelincuencia' },
          { id: 42, name: 'Armas de fuego' },
          { id: 43, name: 'Vehículo prioritario' },
          { id: 44, name: 'Seguridad en conducción de vehículos prioritarios' },
          { id: 45, name: 'PRL en seguridad vial' },
        ] },
    ],
    totalTopics: 45,
    aliases: ['cnp', 'policia nacional', 'escala basica', 'policía', 'pn oposiciones', 'oposiciones policia'],
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/policia-nacional', label: 'Mi Oposición', icon: '👮', featured: true },
      { href: '/policia-nacional/temario', label: 'Temario', icon: '📚' },
      { href: '/policia-nacional/test', label: 'Tests', icon: '🎯' },
    ],
    hasPsychometricTest: true,
  },
  // ========================================
  // POLICÍA MUNICIPAL MADRID (C1)
  // ========================================
  {
    id: 'policia_municipal_madrid',
    slug: 'policia-municipal-madrid',
    positionType: 'policia_municipal_madrid',
    name: 'Policía Municipal del Ayuntamiento de Madrid',
    shortName: 'Policía Municipal Madrid',
    emoji: '🚔',
    badge: 'C1',
    color: 'blue',
    administracion: 'local',
    blocks: [
      { id: 'bloque1', title: 'Constitucional y Administrativo', subtitle: null, icon: '⚖️',
        themes: [
          { id: 1, name: 'CE (I): Estructura y principios' },
          { id: 2, name: 'CE (II): Derechos y deberes' },
          { id: 3, name: 'CE (III): Corona, Cortes, Gobierno, organización territorial' },
          { id: 4, name: 'Derecho Administrativo: legalidad y reglamentos' },
          { id: 5, name: 'Comunidad de Madrid: Estatuto de Autonomía' },
          { id: 6, name: 'Administración Local: municipio y organización' },
          { id: 7, name: 'Reglamento Orgánico del Gobierno del Ayuntamiento de Madrid' },
        ] },
      { id: 'bloque2', title: 'Policía Local', subtitle: null, icon: '🚔',
        themes: [
          { id: 8, name: 'Reglamento del Cuerpo de Policía Municipal (1995)' },
          { id: 9, name: 'LO 4/2010: Régimen disciplinario FCSE' },
          { id: 10, name: 'Ley 1/2018: Coordinación Policías Locales CM' },
          { id: 11, name: 'Reglamento Marco Policías Locales (I)' },
          { id: 12, name: 'Reglamento Marco Policías Locales (II)' },
        ] },
      { id: 'bloque3', title: 'Ordenanzas Municipales', subtitle: null, icon: '📋',
        themes: [
          { id: 13, name: 'Ordenanza del Taxi' },
          { id: 14, name: 'Ordenanza Protección Medio Ambiente Urbano' },
          { id: 15, name: 'Ordenanza Limpieza Espacios Públicos' },
          { id: 16, name: 'Ordenanza Movilidad Sostenible' },
          { id: 17, name: 'Ordenanza Contaminación Acústica y Térmica' },
          { id: 18, name: 'Ordenanza Venta Ambulante' },
          { id: 19, name: 'Establecimientos y actividades recreativas' },
        ] },
      { id: 'bloque4', title: 'Justicia y Penal', subtitle: null, icon: '⚖️',
        themes: [
          { id: 20, name: 'Estructura de tribunales y procedimientos penales' },
          { id: 21, name: 'Código Penal (I): Garantías y aplicación' },
          { id: 22, name: 'Código Penal (II): Penas y medidas de seguridad' },
          { id: 23, name: 'Código Penal (III): Homicidio, lesiones, libertad' },
          { id: 24, name: 'Código Penal (IV): Delitos sexuales y patrimonio' },
          { id: 25, name: 'Código Penal (V): Seguridad colectiva y salud pública' },
          { id: 26, name: 'Código Penal (VI): Seguridad vial' },
          { id: 27, name: 'Código Penal (VII): Admin pública y Constitución' },
        ] },
      { id: 'bloque5', title: 'Tráfico y Circulación', subtitle: null, icon: '🚗',
        themes: [
          { id: 28, name: 'Circulación: organismos y competencias' },
          { id: 29, name: 'Señalización vial' },
          { id: 30, name: 'Denuncias por infracción de circulación' },
          { id: 31, name: 'Accidentes de tráfico' },
          { id: 32, name: 'Alcoholemia' },
        ] },
      { id: 'bloque6', title: 'Seguridad y Derechos', subtitle: null, icon: '🛡️',
        themes: [
          { id: 33, name: 'Modelo policial español' },
          { id: 34, name: 'LO 4/2015 Seguridad Ciudadana' },
          { id: 35, name: 'LO 4/2000 Extranjería' },
          { id: 36, name: 'Ley 5/2002 Drogodependencias CM' },
          { id: 37, name: 'LO 1/2004 Violencia de género' },
          { id: 38, name: 'LO 3/2007 Igualdad' },
          { id: 39, name: 'Ley 4/2023 Trans y LGTBI' },
          { id: 40, name: 'Ley 31/1995 PRL' },
        ] },
    ],
    totalTopics: 40,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/policia-municipal-madrid', label: 'Mi Oposición', icon: '🚔', featured: true },
      { href: '/policia-municipal-madrid/temario', label: 'Temario', icon: '📚' },
      { href: '/policia-municipal-madrid/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // ADMINISTRATIVO DE LA SEGURIDAD SOCIAL (C1)
  // ========================================
  {
    id: 'administrativo_seguridad_social',
    slug: 'administrativo-seguridad-social',
    positionType: 'administrativo_seguridad_social',
    name: 'Administrativo de la Administración de la Seguridad Social',
    shortName: 'Admin. SS',
    emoji: '🩺',
    badge: 'C1',
    color: 'emerald',
    administracion: 'estado',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Temario general',
        subtitle: 'Organización del Estado, Derecho administrativo, UE',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Derechos y deberes fundamentales' },
          { id: 3, name: 'El Tribunal Constitucional' },
          { id: 4, name: 'La Corona' },
          { id: 5, name: 'El poder legislativo' },
          { id: 6, name: 'El Poder Judicial' },
          { id: 7, name: 'El poder ejecutivo' },
          { id: 8, name: 'La Administración General del Estado' },
          { id: 9, name: 'Organización territorial del Estado' },
          { id: 10, name: 'Instituciones de la Unión Europea' },
          { id: 11, name: 'Fuentes del derecho de la Unión Europea' },
          { id: 12, name: 'Ministerio de Inclusión, Seguridad Social y Migraciones' },
          { id: 13, name: 'Fuentes del Derecho Administrativo' },
          { id: 14, name: 'La Ley. Tipos de leyes' },
          { id: 15, name: 'Los actos administrativos' },
          { id: 16, name: 'El procedimiento administrativo común' },
          { id: 17, name: 'Fases del procedimiento administrativo' },
          { id: 18, name: 'Los recursos administrativos' },
          { id: 19, name: 'Personal al servicio de las AAPP' },
          { id: 20, name: 'Atención al público' },
          { id: 21, name: 'Políticas de igualdad y discapacidad' },
          { id: 22, name: 'Protección de datos personales' },
          { id: 23, name: 'Funcionamiento electrónico del sector público' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Temario específico de Seguridad Social',
        subtitle: 'Régimen general, cotización, prestaciones',
        icon: '🩺',
        themes: [
          { id: 101, name: 'La Seguridad Social en la CE. TRLGSS', displayNumber: 1 },
          { id: 102, name: 'Campo de aplicación y composición del sistema SS', displayNumber: 2 },
          { id: 103, name: 'Afiliación. Altas y bajas', displayNumber: 3 },
          { id: 104, name: 'La cotización a la Seguridad Social', displayNumber: 4 },
          { id: 105, name: 'La gestión recaudatoria', displayNumber: 5 },
          { id: 106, name: 'Recaudación en vía ejecutiva', displayNumber: 6 },
          { id: 107, name: 'Acción protectora. Prestaciones', displayNumber: 7 },
          { id: 108, name: 'Incapacidad temporal y permanente', displayNumber: 8 },
          { id: 109, name: 'Nacimiento y cuidado de menor', displayNumber: 9 },
          { id: 110, name: 'Jubilación contributiva', displayNumber: 10 },
          { id: 111, name: 'Muerte y supervivencia', displayNumber: 11 },
          { id: 112, name: 'Prestaciones no contributivas. IMV', displayNumber: 12 },
          { id: 113, name: 'Recursos generales del sistema SS', displayNumber: 13 },
        ],
      },
    ],
    totalTopics: 36,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/administrativo-seguridad-social', label: 'Mi Oposición', icon: '🩺', featured: true },
      { href: '/administrativo-seguridad-social/temario', label: 'Temario', icon: '📚' },
      { href: '/administrativo-seguridad-social/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ============================================
  // CORREOS — Personal Operativo C2
  // ============================================
  {
    id: 'correos_personal_operativo',
    slug: 'correos-personal-operativo',
    positionType: 'correos_personal_operativo',
    name: 'Personal Operativo de Correos',
    shortName: 'Correos C2',
    emoji: '📮',
    badge: 'C2',
    color: 'yellow',
    administracion: 'empresa_publica',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: La Empresa y sus Productos',
        subtitle: 'Marco normativo, productos, servicios y herramientas',
        icon: '📮',
        themes: [
          { id: 1, name: 'Correos: Marco Normativo Postal y Naturaleza Jurídica' },
          { id: 2, name: 'Experiencia de Personas en Correos' },
          { id: 3, name: 'Productos y Servicios: Comunicación y Paquetería' },
          { id: 4, name: 'Productos y Servicios: Oficinas, Financieros y Digitales' },
          { id: 5, name: 'Nuevas Líneas de Negocio' },
          { id: 6, name: 'Herramientas Corporativas' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Operaciones y Normativa',
        subtitle: 'Procesos operativos, atención al cliente y cumplimiento',
        icon: '📦',
        themes: [
          { id: 7, name: 'Procesos Operativos I: Admisión' },
          { id: 8, name: 'Procesos Operativos II: Tratamiento y Transporte' },
          { id: 9, name: 'Procesos Operativos III: Distribución y Entrega' },
          { id: 10, name: 'El Cliente: Atención y Calidad' },
          { id: 11, name: 'Internacionalización y Aduanas' },
          { id: 12, name: 'Normas de Cumplimiento' },
        ],
      },
    ],
    totalTopics: 12,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/correos-personal-operativo', label: 'Mi Oposición', icon: '📮', featured: true },
      { href: '/correos-personal-operativo/temario', label: 'Temario', icon: '📚' },
      { href: '/correos-personal-operativo/test', label: 'Tests', icon: '🎯' },
    ],
  },
]

// ============================================
// VALORES DERIVADOS (para Zod enums y mapas)
// ============================================

/** Todos los IDs de oposición (para BD target_oposicion) */
export const ALL_OPOSICION_IDS = [...OPOSICIONES.map(o => o.id), 'explorador']

/** Todos los slugs de oposición (para URLs) */
export const ALL_OPOSICION_SLUGS = OPOSICIONES.map(o => o.slug)

/** Tupla de slugs compatible con z.enum() */
export const OPOSICION_SLUGS_ENUM = ALL_OPOSICION_SLUGS as [string, ...string[]]

/** Todos los positionType (para BD topics.position_type) */
export const ALL_POSITION_TYPES = OPOSICIONES.map(o => o.positionType)

/** Tupla de positionTypes compatible con z.enum() */
export const POSITION_TYPES_ENUM = ALL_POSITION_TYPES as [string, ...string[]]

/** Mapa slug → positionType */
export const SLUG_TO_POSITION_TYPE: Record<string, string> = Object.fromEntries(
  OPOSICIONES.map(o => [o.slug, o.positionType])
)

/** Mapa id → positionType */
export const ID_TO_POSITION_TYPE: Record<string, string> = Object.fromEntries(
  OPOSICIONES.map(o => [o.id, o.positionType])
)

/** Mapa id → slug */
export const ID_TO_SLUG: Record<string, string> = Object.fromEntries(
  OPOSICIONES.map(o => [o.id, o.slug])
)

/** Mapa slug → id */
export const SLUG_TO_ID: Record<string, string> = Object.fromEntries(
  OPOSICIONES.map(o => [o.slug, o.id])
)

/** Mapa positionType → slug (inverso de SLUG_TO_POSITION_TYPE) */
export const POSITION_TYPE_TO_SLUG: Record<string, string> = Object.fromEntries(
  OPOSICIONES.map(o => [o.positionType, o.slug])
)

/** Tupla de IDs compatible con z.enum() */
export const OPOSICION_IDS_ENUM = ALL_OPOSICION_IDS as [string, ...string[]]

// ============================================
// FUNCIONES HELPER
// ============================================

/** Busca una oposición por su slug de URL */
export function getOposicionBySlug(slug: string): Oposicion | undefined {
  return OPOSICIONES.find(o => o.slug === slug)
}

/** Busca una oposición por su ID de BD (target_oposicion) */
export function getOposicionById(id: string): Oposicion | undefined {
  return OPOSICIONES.find(o => o.id === id)
}

/** Busca una oposición por su positionType de BD */
export function getOposicionByPositionType(positionType: string): Oposicion | undefined {
  return OPOSICIONES.find(o => o.positionType === positionType)
}

/**
 * Busca una oposición por cualquier identificador (id, slug, o positionType).
 * Útil cuando no se sabe qué tipo de identificador se tiene.
 */
export function getOposicion(identifier: string): Oposicion | undefined {
  return getOposicionById(identifier) || getOposicionBySlug(identifier) || getOposicionByPositionType(identifier)
}

/** Devuelve el enlace a /test para una oposición dada (por id o slug) */
export function getTestsLink(identifier: string): string {
  const oposicion = getOposicion(identifier)
  return oposicion ? `/${oposicion.slug}/test` : '/'
}

/** Devuelve el enlace a /temario para una oposición dada (por id o slug) */
export function getTemarioLink(identifier: string): string {
  const oposicion = getOposicion(identifier)
  return oposicion ? `/${oposicion.slug}/temario` : '/'
}

/** Devuelve el enlace a la home de una oposición dada (por id o slug) */
export function getHomeLink(identifier: string): string {
  const oposicion = getOposicion(identifier)
  return oposicion ? `/${oposicion.slug}` : '/'
}

/**
 * Genera el string mostrado al usuario para una parte de examen oficial.
 *
 * Prefiere los campos estructurados (ordinaryCount/reserveCount/breakdown/
 * durationMin/notes). Si la entry sigue en formato legacy, devuelve
 * `description` literal. Fuente única para evitar que dos vistas diverjan.
 */
export function formatParteDescription(parte: OfficialExamParte): string {
  const hasStructured =
    parte.ordinaryCount !== undefined ||
    (parte.breakdown && parte.breakdown.length > 0)

  if (!hasStructured) return parte.description ?? ''

  const pieces: string[] = []

  if (parte.breakdown && parte.breakdown.length > 1) {
    // Varios sub-bloques → "60 preguntas (30 psicotécnicas + 30 Bloque I)"
    const total = parte.breakdown.reduce((s, b) => s + b.count, 0)
    const inner = parte.breakdown.map((b) => `${b.count} ${b.label}`).join(' + ')
    pieces.push(`${total} preguntas (${inner})`)
  } else if (parte.breakdown && parte.breakdown.length === 1) {
    // Un único sub-bloque → "30 preguntas Bloque II Ofimática"
    const only = parte.breakdown[0]
    pieces.push(`${only.count} preguntas ${only.label}`)
  } else if (parte.ordinaryCount !== undefined) {
    pieces.push(`${parte.ordinaryCount} preguntas`)
  }

  if (parte.reserveCount && parte.reserveCount > 0) {
    pieces.push(`+ ${parte.reserveCount} reserva`)
  }
  if (parte.notes) {
    pieces.push(parte.notes)
  }
  if (parte.durationMin) {
    pieces.push(`— ${parte.durationMin} min`)
  }

  return pieces.join(' ')
}

const ROMAN_NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii']

/**
 * Determina el bloque para un tema dado en una oposición.
 * Retorna { blockId, blockTitle, displayNum } o null si no se encuentra.
 * blockId usa numeración romana (bloque-i, bloque-ii, ...) para coincidir con anchors HTML.
 * displayNum ajusta automáticamente para bloques con offset (ej: tema 101 → display 1).
 */
export function getBlockForTopic(identifier: string, topicNum: number): {
  blockId: string
  blockTitle: string
  displayNum: number
} | null {
  const oposicion = getOposicion(identifier)
  if (!oposicion) return null

  for (let i = 0; i < oposicion.blocks.length; i++) {
    const block = oposicion.blocks[i]
    const theme = block.themes.find(t => t.id === topicNum)
    if (theme) {
      const firstId = block.themes[0].id
      // Si el primer tema del bloque tiene ID >= 100, es offset-based
      const displayNum = firstId >= 100 ? topicNum - firstId + 1 : topicNum
      return {
        blockId: `bloque-${ROMAN_NUMERALS[i]}`,
        blockTitle: block.title.split(':')[0]?.trim() || block.title,
        displayNum,
      }
    }
  }
  return null
}

/** Convierte slug a positionType para queries a BD */
export function slugToPositionType(slug: string): string | null {
  return SLUG_TO_POSITION_TYPE[slug] ?? null
}

/** Convierte positionType a slug para URLs */
export function positionTypeToSlug(positionType: string): string | null {
  const oposicion = getOposicionByPositionType(positionType)
  return oposicion?.slug ?? null
}

/**
 * Extrae el slug de oposición de un pathname.
 * Busca el primer segmento que coincida con un slug registrado.
 * Escalable: al añadir una oposición nueva, funciona automáticamente.
 */
export function getOposicionSlugFromPathname(pathname: string | null): string {
  if (!pathname) return ALL_OPOSICION_SLUGS[0]
  const segments = pathname.split('/').filter(Boolean)
  for (const segment of segments) {
    if (ALL_OPOSICION_SLUGS.includes(segment)) {
      return segment
    }
  }
  return ALL_OPOSICION_SLUGS[0]
}

/** Obtiene todos los temas de una oposición como lista plana */
export function getAllThemes(identifier: string): Theme[] {
  const oposicion = getOposicion(identifier)
  if (!oposicion) return []
  return oposicion.blocks.flatMap(block => block.themes)
}

/** Obtiene el nombre de un tema por su ID (sync, config como fallback) */
export function getThemeName(identifier: string, themeId: number): string {
  const themes = getAllThemes(identifier)
  return themes.find(t => t.id === themeId)?.name || ''
}

/** Obtiene los nombres de múltiples temas (sync, config como fallback) */
export function getThemeNames(identifier: string, themeIds: number[]): Record<number, string> {
  const themes = getAllThemes(identifier)
  const result: Record<number, string> = {}
  for (const id of themeIds) {
    const theme = themes.find(t => t.id === id)
    if (theme) result[id] = theme.name
  }
  return result
}

// Para obtener nombres de temas desde BD en server components, usar directamente:
//   import { getTopicNamesMap } from '@/lib/api/topic-names/queries'
// NO importar BD queries desde este archivo — es compartido server+client.

/** Lista de oposiciones disponibles (datos básicos) */
export function getAvailableOposiciones() {
  return OPOSICIONES.map(o => ({
    id: o.id,
    name: o.name,
    shortName: o.shortName,
    slug: o.slug,
    totalTopics: o.totalTopics,
  }))
}

/** Valida si un identificador corresponde a una oposición existente */
export function isValidOposicion(identifier: string): boolean {
  return getOposicion(identifier) !== undefined
}

// ============================================
// COMPATIBILIDAD: Re-exportar con nombres del viejo .js
// ============================================

/** @deprecated Usar OPOSICIONES directamente */
export const OPOSICIONES_CONFIG: Record<string, {
  id: string
  name: string
  shortName: string
  slug: string
  positionType: string
  totalThemes: number
  themeBlocks: Array<{
    id: string
    title: string
    subtitle: string | null
    themes: Theme[]
  }>
}> = Object.fromEntries(
  OPOSICIONES.map(o => [o.positionType === 'auxiliar_administrativo' ? 'auxiliar_administrativo' : o.id, {
    id: o.id,
    name: o.name,
    shortName: o.shortName,
    slug: o.slug,
    positionType: o.positionType,
    totalThemes: o.totalTopics,
    themeBlocks: o.blocks.map(b => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      themes: b.themes,
    })),
  }])
)

/** @deprecated Usar getOposicion() */
export function getOposicionConfig(identifier: string) {
  return getOposicion(identifier) ? OPOSICIONES_CONFIG[identifier] || Object.values(OPOSICIONES_CONFIG).find(c => c.slug === identifier) || null : null
}

/**
 * Tags exclusivos de oposiciones con questionTag.
 * Las oposiciones sin questionTag deben excluir preguntas con estos tags
 * para no mezclar formatos (ej: 3 opciones de PN en oposiciones de 4 opciones).
 */
export const EXCLUSIVE_QUESTION_TAGS: string[] = OPOSICIONES
  .map(o => o.questionTag)
  .filter((t): t is string => !!t)

export default OPOSICIONES
