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
  administracion: z.enum(['estado', 'justicia', 'autonomica']),
  blocks: z.array(BlockSchema),
  totalTopics: z.number(),
  navLinks: z.array(NavLinkSchema),
})

// ============================================
// TIPOS DERIVADOS
// ============================================

export type Theme = z.infer<typeof ThemeSchema>
export type Block = z.infer<typeof BlockSchema>
export type NavLink = z.infer<typeof NavLinkSchema>
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
    positionType: 'auxiliar_administrativo',
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
          { id: 2, name: 'El Tribunal Constitucional. La Corona' },
          { id: 3, name: 'Las Cortes Generales' },
          { id: 4, name: 'El Poder Judicial' },
          { id: 5, name: 'El Gobierno y la Administración' },
          { id: 6, name: 'El Gobierno Abierto. Agenda 2030' },
          { id: 7, name: 'Ley 19/2013 de Transparencia' },
          { id: 8, name: 'La Administración General del Estado' },
          { id: 9, name: 'La Organización Territorial del Estado' },
          { id: 10, name: 'La Organización de la Unión Europea' },
          { id: 11, name: 'Las Leyes del Procedimiento Administrativo' },
          { id: 12, name: 'La Protección de Datos Personales' },
          { id: 13, name: 'El Personal Funcionario' },
          { id: 14, name: 'Derechos y Deberes de los Funcionarios' },
          { id: 15, name: 'El Presupuesto del Estado en España' },
          { id: 16, name: 'Políticas de Igualdad y contra la Violencia de Género' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Actividad Administrativa',
        subtitle: 'Informática y Atención al Ciudadano',
        icon: '💻',
        themes: [
          { id: 101, name: 'Atención al ciudadano' },
          { id: 102, name: 'Servicios de información administrativa' },
          { id: 103, name: 'Documento, registro y archivo' },
          { id: 104, name: 'Administración electrónica' },
          { id: 105, name: 'Informática básica' },
          { id: 106, name: 'Sistema operativo Windows 11' },
          { id: 107, name: 'Explorador de Windows 11' },
          { id: 108, name: 'Word' },
          { id: 109, name: 'Excel' },
          { id: 110, name: 'Access' },
          { id: 111, name: 'Correo electrónico' },
          { id: 112, name: 'Internet' },
        ],
      },
    ],
    totalTopics: 28,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-estado', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-estado/test', label: 'Tests', icon: '🎯' },
      { href: '/auxiliar-administrativo-estado/simulacros', label: 'Simulacros', icon: '🏆' },
    ],
  },

  // ========================================
  // ADMINISTRATIVO DEL ESTADO (C1)
  // ========================================
  {
    id: 'administrativo_estado',
    slug: 'administrativo-estado',
    positionType: 'administrativo',
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
          { id: 2, name: 'Igualdad y no discriminación' },
          { id: 3, name: 'El Gobierno y la Administración' },
          { id: 4, name: 'Organización territorial del Estado' },
          { id: 5, name: 'La Unión Europea' },
          { id: 6, name: 'El Poder Judicial' },
          { id: 7, name: 'Organización y competencia (I)' },
          { id: 8, name: 'Organización y competencia (II)' },
          { id: 9, name: 'Carta de Derechos ante la Justicia' },
          { id: 10, name: 'La modernización de la oficina judicial' },
          { id: 11, name: 'El Letrado de la Administración de Justicia' },
          { id: 12, name: 'Los Cuerpos de funcionarios' },
          { id: 13, name: 'Los Cuerpos Generales (I)' },
          { id: 14, name: 'Los Cuerpos Generales (II)' },
          { id: 15, name: 'Libertad sindical' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Derecho Procesal',
        subtitle: 'Procedimientos civiles, penales y administrativos',
        icon: '📜',
        themes: [
          { id: 16, name: 'Procedimientos declarativos LEC' },
          { id: 17, name: 'Procedimientos de ejecución LEC' },
          { id: 18, name: 'Procesos especiales LEC' },
          { id: 19, name: 'La jurisdicción voluntaria' },
          { id: 20, name: 'Procedimientos penales (I)' },
          { id: 21, name: 'Procedimientos penales (II)' },
          { id: 22, name: 'El recurso contencioso-administrativo' },
          { id: 23, name: 'El proceso laboral' },
          { id: 24, name: 'Los recursos' },
          { id: 25, name: 'Los actos procesales' },
          { id: 26, name: 'Las resoluciones judiciales' },
          { id: 27, name: 'Comunicación con otros tribunales' },
          { id: 28, name: 'Comunicación a las partes' },
          { id: 29, name: 'El Registro Civil (I)' },
          { id: 30, name: 'El Registro Civil (II)' },
          { id: 31, name: 'El archivo judicial' },
        ],
      },
      {
        id: 'bloque3',
        title: 'Bloque III: Informática',
        subtitle: 'Ofimática y tecnología',
        icon: '💻',
        themes: [
          { id: 32, name: 'Informática básica' },
          { id: 33, name: 'Sistema operativo Windows' },
          { id: 34, name: 'El explorador de Windows' },
          { id: 35, name: 'Procesadores de texto: Word 365' },
          { id: 36, name: 'Correo electrónico: Outlook 365' },
          { id: 37, name: 'La Red Internet' },
        ],
      },
    ],
    totalTopics: 37,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/tramitacion-procesal', label: 'Mi Oposición', icon: '⚖️', featured: true },
      { href: '/tramitacion-procesal/temario', label: 'Temario', icon: '📚' },
      { href: '/tramitacion-procesal/test', label: 'Tests', icon: '🎯' },
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
          { id: 7, name: 'Revisión de actos y responsabilidad patrimonial' },
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
    ],
    totalTopics: 16,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-carm', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-carm/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-carm/test', label: 'Tests', icon: '🎯' },
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
          { id: 1, name: 'La Constitución Española' },
          { id: 2, name: 'La Administración General del Estado' },
          { id: 3, name: 'La Administración local y organización territorial de CyL' },
          { id: 4, name: 'La Unión Europea' },
          { id: 5, name: 'El Estatuto de Autonomía de Castilla y León' },
          { id: 6, name: 'Las Cortes de Castilla y León' },
          { id: 7, name: 'Instituciones propias de CyL' },
          { id: 8, name: 'El Gobierno de CyL' },
          { id: 9, name: 'La Administración de CyL' },
          { id: 10, name: 'El sector público de CyL' },
          { id: 11, name: 'Las fuentes del derecho administrativo' },
          { id: 12, name: 'El acto administrativo' },
          { id: 13, name: 'El procedimiento administrativo común' },
          { id: 14, name: 'Órganos de las Administraciones Públicas' },
          { id: 15, name: 'El Estatuto Básico del Empleado Público' },
          { id: 16, name: 'La Función Pública de Castilla y León' },
          { id: 17, name: 'Sindicación, huelga e incompatibilidades' },
          { id: 18, name: 'El presupuesto de CyL' },
          { id: 19, name: 'Políticas de igualdad y no discriminación en CyL' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Grupo II: Competencias',
        subtitle: 'Atención al público, Informática y Administración Electrónica',
        icon: '📋',
        themes: [
          { id: 20, name: 'Derechos de las personas y atención al público' },
          { id: 21, name: 'Oficinas de asistencia en materia de registros' },
          { id: 22, name: 'Administración electrónica' },
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
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-cyl', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-cyl/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-cyl/test', label: 'Tests', icon: '🎯' },
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
          { id: 2, name: 'Organización territorial del Estado' },
          { id: 3, name: 'La Comunidad Autónoma de Andalucía' },
          { id: 4, name: 'Organización Institucional de la Comunidad Autónoma de Andalucía' },
          { id: 5, name: 'Organización de la Administración de la Junta de Andalucía' },
          { id: 6, name: 'El Derecho Administrativo' },
          { id: 7, name: 'El procedimiento administrativo común' },
          { id: 8, name: 'Normativa sobre Igualdad y de Género' },
          { id: 9, name: 'La Igualdad de Género en las Políticas Públicas' },
          { id: 10, name: 'El presupuesto de la Comunidad Autónoma de Andalucía' },
          { id: 11, name: 'La función pública en la Administración de la Junta de Andalucía' },
          { id: 12, name: 'El sistema español de Seguridad Social' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Organización y Gestión Administrativa',
        subtitle: 'Atención al público, Documentos, Informática y Administración Electrónica',
        icon: '📋',
        themes: [
          { id: 13, name: 'La comunicación' },
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
          { id: 3, name: 'La Ley de Gobierno y Administración de la CAM' },
          { id: 4, name: 'Las fuentes del ordenamiento jurídico' },
          { id: 5, name: 'El acto administrativo' },
          { id: 6, name: 'La Ley del Procedimiento Administrativo Común' },
          { id: 7, name: 'La Jurisdicción Contencioso-Administrativa' },
          { id: 8, name: 'Transparencia y Protección de Datos' },
          { id: 9, name: 'Los contratos en el Sector Público' },
          { id: 10, name: 'El Estatuto Básico del Empleado Público' },
          { id: 11, name: 'La Seguridad Social' },
          { id: 12, name: 'Hacienda Pública y Presupuestos de la CAM' },
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
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-madrid', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-madrid/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-madrid/test', label: 'Tests', icon: '🎯' },
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
          { id: 1, name: 'Gobierno y Administracion de la CAE (I)' },
          { id: 2, name: 'Gobierno y Administracion de la CAE (II)' },
          { id: 3, name: 'Estatuto Basico del Empleado Publico' },
          { id: 4, name: 'Funcion Publica de Extremadura (I)' },
          { id: 5, name: 'Funcion Publica de Extremadura (II)' },
          { id: 6, name: 'Funcion Publica de Extremadura (III)' },
          { id: 7, name: 'Funcion Publica de Extremadura (IV)' },
          { id: 8, name: 'Funcion Publica de Extremadura (V)' },
          { id: 9, name: 'Funcion Publica de Extremadura (VI)' },
          { id: 10, name: 'Personal Laboral CC (I)' },
          { id: 11, name: 'Personal Laboral CC (II)' },
          { id: 12, name: 'Personal Laboral CC (III)' },
          { id: 13, name: 'Prevencion de Riesgos Laborales' },
          { id: 14, name: 'Igualdad y violencia de genero en Extremadura' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Derecho Administrativo y Ofimatica',
        subtitle: 'Ley 40/2015, Ley 39/2015, Contratos, Windows, Office',
        icon: '💻',
        themes: [
          { id: 15, name: 'Regimen Juridico del Sector Publico (I)' },
          { id: 16, name: 'Regimen Juridico del Sector Publico (II)' },
          { id: 17, name: 'Procedimiento Administrativo Comun (I)' },
          { id: 18, name: 'Procedimiento Administrativo Comun (II)' },
          { id: 19, name: 'Procedimiento Administrativo Comun (III)' },
          { id: 20, name: 'Contratacion del Sector Publico' },
          { id: 21, name: 'Documento, registro y archivo' },
          { id: 22, name: 'Administracion electronica Extremadura (I)' },
          { id: 23, name: 'Administracion electronica Extremadura (II)' },
          { id: 24, name: 'Windows 10' },
          { id: 25, name: 'Office 365: Word y Excel' },
        ],
      },
    ],
    totalTopics: 25,
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
        title: 'Materias Comunes',
        subtitle: 'Constitucion, Estatuto CV, UE, Igualdad',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'CE: Titulo Preliminar, Titulo I, Titulo X' },
          { id: 2, name: 'CE: Titulo II Corona, Titulo III Cortes' },
          { id: 3, name: 'CE: Titulo IV Gobierno, Titulo V' },
          { id: 4, name: 'CE: Titulo VI Poder Judicial, Titulo IX TC' },
          { id: 5, name: 'CE: Titulo VIII Organizacion territorial' },
          { id: 6, name: 'Estatuto de Autonomia de la Comunitat Valenciana' },
          { id: 7, name: 'Ley 5/1983 del Consell (I)' },
          { id: 8, name: 'Ley 5/1983 del Consell (II)' },
          { id: 9, name: 'Derecho de la UE' },
          { id: 10, name: 'Igualdad: LO 3/2007, Ley 9/2003 GVA, LO 1/2004' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Materias Especificas',
        subtitle: 'Procedimiento, Contratos, Funcion Publica, Presupuestos',
        icon: '⚖️',
        themes: [
          { id: 11, name: 'Ley 39/2015 (I): Disposiciones generales' },
          { id: 12, name: 'Ley 39/2015 (II): Actos administrativos' },
          { id: 13, name: 'Ley 39/2015 (III): Nulidad y anulabilidad' },
          { id: 14, name: 'Ley 39/2015 (IV): Procedimiento administrativo' },
          { id: 15, name: 'Ley 39/2015 (V): Revision en via administrativa' },
          { id: 16, name: 'Organos AAPP: competencia, delegacion' },
          { id: 17, name: 'Contratos del Sector Publico' },
          { id: 18, name: 'Admin electronica CV + Proteccion de datos' },
          { id: 19, name: 'Funcion Publica Valenciana (I)' },
          { id: 20, name: 'Funcion Publica Valenciana (II)' },
          { id: 21, name: 'Presupuestos: concepto, principios, ciclo' },
          { id: 22, name: 'Ejecucion presupuestaria' },
          { id: 23, name: 'Gestion presupuestaria GVA' },
          { id: 24, name: 'LibreOffice 6.1: Writer, Calc, Base' },
        ],
      },
    ],
    totalTopics: 24,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-valencia', label: 'Mi Oposicion', icon: '🍊', featured: true },
      { href: '/auxiliar-administrativo-valencia/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-valencia/test', label: 'Tests', icon: '🎯' },
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
          { id: 1, name: 'CE: T.Preliminar, T.I (excepto cap 3), T.II, T.III (cap 1), T.IV, T.V, T.VIII' },
          { id: 2, name: 'Estatuto de Autonomia de Galicia (LO 1/1981)' },
          { id: 3, name: 'Derecho derivado UE: reglamentos, directivas, decisiones' },
          { id: 4, name: 'Instituciones UE: Parlamento, Consejo Europeo, Consejo, Comision' },
          { id: 5, name: 'Ley 31/1995 PRL: capitulo III' },
          { id: 6, name: 'Ley 16/2010 organizacion Administracion Galicia' },
          { id: 7, name: 'Ley 39/2015 LPAC: T.Preliminar a T.V' },
          { id: 8, name: 'Ley 40/2015 LRJSP: caps I-V titulo preliminar' },
          { id: 9, name: 'DL 1/1999 regimen financiero Galicia' },
          { id: 10, name: 'Ley 1/2016 transparencia Galicia' },
          { id: 11, name: 'Ley 2/2015 empleo publico Galicia' },
          { id: 12, name: 'Ley 7/2023 igualdad Galicia' },
          { id: 13, name: 'RDL 1/2013 discapacidad' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Parte Especifica',
        subtitle: 'Gestion documental, Informatica, Ofimatica',
        icon: '💻',
        themes: [
          { id: 14, name: 'Gestion de documentos en la Xunta de Galicia' },
          { id: 15, name: 'Informatica basica: componentes, redes, almacenamiento' },
          { id: 16, name: 'Sistemas operativos: administrador de archivos' },
          { id: 17, name: 'Sistemas ofimaticos: Writer, Calc, Impress, correo' },
        ],
      },
    ],
    totalTopics: 17,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-galicia', label: 'Mi Oposicion', icon: '🐚', featured: true },
      { href: '/auxiliar-administrativo-galicia/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-galicia/test', label: 'Tests', icon: '🎯' },
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
          { id: 6, name: 'El derecho administrativo. Ley 39/2015' },
          { id: 7, name: 'Disposiciones y actos administrativos' },
          { id: 8, name: 'Eficacia y validez de los actos administrativos' },
          { id: 9, name: 'Protección de datos personales' },
          { id: 10, name: 'Igualdad efectiva de mujeres y hombres' },
          { id: 11, name: 'Información y atención al público' },
          { id: 12, name: 'Los documentos administrativos' },
          { id: 13, name: 'Gobierno Abierto y transparencia' },
          { id: 14, name: 'Prevención de Riesgos Laborales' },
          { id: 15, name: 'Administración electrónica' },
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
          { id: 6, name: 'El Presidente y Consejo de Gobierno del Principado' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Derecho Administrativo y Comunitario',
        subtitle: 'UE, LPAC, LRJSP, TREBEP, LGSS, Igualdad, Transparencia',
        icon: '⚖️',
        themes: [
          { id: 7, name: 'El Tratado de la Unión Europea' },
          { id: 8, name: 'Ley 39/2015 de Procedimiento Administrativo Común' },
          { id: 9, name: 'Ley 40/2015 de Régimen Jurídico del Sector Público' },
          { id: 10, name: 'Régimen Jurídico de la Administración del Principado' },
          { id: 11, name: 'El Estatuto Básico del Empleado Público' },
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
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-asturias', label: 'Mi Oposición', icon: '⛰️', featured: true },
      { href: '/auxiliar-administrativo-asturias/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-asturias/test', label: 'Tests', icon: '🎯' },
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
          { id: 7, name: 'Organización y competencia (I)' },
          { id: 8, name: 'Organización y competencia (II)' },
          { id: 9, name: 'Carta de Derechos ante la Justicia' },
          { id: 10, name: 'La modernización de la oficina judicial' },
          { id: 11, name: 'El Letrado de la Administración de Justicia' },
          { id: 12, name: 'Los Cuerpos de funcionarios' },
          { id: 13, name: 'Los Cuerpos Generales (I)' },
          { id: 14, name: 'Los Cuerpos Generales (II)' },
          { id: 15, name: 'Libertad sindical' },
        ],
      },
      {
        id: 'bloque3',
        title: 'Bloque III: Procedimientos y Actos Procesales',
        subtitle: 'Procedimientos, Registros y Archivo',
        icon: '📜',
        themes: [
          { id: 16, name: 'Procedimientos declarativos LEC' },
          { id: 17, name: 'Procedimientos de ejecución LEC' },
          { id: 18, name: 'Procesos especiales LEC' },
          { id: 19, name: 'La jurisdicción voluntaria' },
          { id: 20, name: 'Procedimientos penales' },
          { id: 21, name: 'El recurso contencioso-administrativo' },
          { id: 22, name: 'El proceso laboral' },
          { id: 23, name: 'Los actos procesales' },
          { id: 24, name: 'Las resoluciones judiciales' },
          { id: 25, name: 'El Registro Civil' },
          { id: 26, name: 'El archivo judicial' },
        ],
      },
    ],
    totalTopics: 26,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxilio-judicial', label: 'Mi Oposición', icon: '⚖️', featured: true },
      { href: '/auxilio-judicial/temario', label: 'Temario', icon: '📚' },
      { href: '/auxilio-judicial/test', label: 'Tests', icon: '🎯' },
    ],
  },
]

// ============================================
// VALORES DERIVADOS (para Zod enums y mapas)
// ============================================

/** Todos los IDs de oposición (para BD target_oposicion) */
export const ALL_OPOSICION_IDS = OPOSICIONES.map(o => o.id)

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

/** Obtiene todos los temas de una oposición como lista plana */
export function getAllThemes(identifier: string): Theme[] {
  const oposicion = getOposicion(identifier)
  if (!oposicion) return []
  return oposicion.blocks.flatMap(block => block.themes)
}

/** Obtiene el nombre de un tema por su ID */
export function getThemeName(identifier: string, themeId: number): string {
  const themes = getAllThemes(identifier)
  return themes.find(t => t.id === themeId)?.name || ''
}

/** Obtiene los nombres de múltiples temas */
export function getThemeNames(identifier: string, themeIds: number[]): Record<number, string> {
  const themes = getAllThemes(identifier)
  const result: Record<number, string> = {}
  for (const id of themeIds) {
    const theme = themes.find(t => t.id === id)
    if (theme) result[id] = theme.name
  }
  return result
}

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

export default OPOSICIONES
