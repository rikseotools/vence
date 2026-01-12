// lib/config/oposiciones.js - Configuración centralizada de oposiciones
// Este archivo contiene la configuración de temas para cada tipo de oposición

export const OPOSICIONES_CONFIG = {
  // ========================================
  // ADMINISTRATIVO DEL ESTADO (C1) - 45 temas
  // ========================================
  administrativo_estado: {
    id: 'administrativo_estado',
    name: 'Administrativo del Estado',
    shortName: 'AGE C1',
    slug: 'administrativo-estado',
    positionType: 'administrativo_estado', // Valor para BD
    totalThemes: 45,
    themeBlocks: [
      {
        id: 'block1',
        title: 'Bloque I: Organización del Estado',
        subtitle: '11 temas - Constitución, Gobierno, Administración',
        themes: [
          { id: 1, name: "La Constitución Española de 1978" },
          { id: 2, name: "La Jefatura del Estado. La Corona" },
          { id: 3, name: "Las Cortes Generales" },
          { id: 4, name: "El Poder Judicial" },
          { id: 5, name: "El Gobierno y la Administración" },
          { id: 6, name: "El Gobierno Abierto. Agenda 2030" },
          { id: 7, name: "La Ley 19/2013 de Transparencia" },
          { id: 8, name: "La Administración General del Estado" },
          { id: 9, name: "La Organización Territorial del Estado" },
          { id: 10, name: "La Administración Local" },
          { id: 11, name: "La Organización de la Unión Europea" }
        ]
      },
      {
        id: 'block2',
        title: 'Bloque II: Organización de Oficinas Públicas',
        subtitle: '4 temas - Atención ciudadana, Registros, Archivos',
        themes: [
          { id: 12, name: "Atención al Público" },
          { id: 13, name: "Documento, Registro y Archivo" },
          { id: 14, name: "Administración Electrónica" },
          { id: 15, name: "Protección de Datos Personales" }
        ]
      },
      {
        id: 'block3',
        title: 'Bloque III: Derecho Administrativo General',
        subtitle: '7 temas - Procedimiento, Contratos, Responsabilidad',
        themes: [
          { id: 16, name: "Las Fuentes del Derecho Administrativo" },
          { id: 17, name: "El Acto Administrativo" },
          { id: 18, name: "Las Leyes del Procedimiento Administrativo" },
          { id: 19, name: "Los Contratos del Sector Público" },
          { id: 20, name: "Procedimientos y Formas de la Actividad Administrativa" },
          { id: 21, name: "La Responsabilidad Patrimonial" },
          { id: 22, name: "Políticas de Igualdad" }
        ]
      },
      {
        id: 'block4',
        title: 'Bloque IV: Gestión de Personal',
        subtitle: '9 temas - Empleo público, Derechos, Deberes',
        themes: [
          { id: 23, name: "El Personal al Servicio de las Administraciones Públicas" },
          { id: 24, name: "Selección de Personal" },
          { id: 25, name: "El Personal Funcionario" },
          { id: 26, name: "Adquisición y Pérdida de la Condición de Funcionario" },
          { id: 27, name: "Provisión de Puestos de Trabajo" },
          { id: 28, name: "Las Incompatibilidades y Régimen Disciplinario" },
          { id: 29, name: "El Régimen de la Seguridad Social de los Funcionarios" },
          { id: 30, name: "El Personal Laboral" },
          { id: 31, name: "El Régimen de la Seguridad Social del Personal Laboral" }
        ]
      },
      {
        id: 'block5',
        title: 'Bloque V: Gestión Financiera',
        subtitle: '6 temas - Presupuestos, Gastos, Retribuciones',
        themes: [
          { id: 32, name: "El Presupuesto" },
          { id: 33, name: "El Presupuesto del Estado en España" },
          { id: 34, name: "El Procedimiento de Ejecución del Presupuesto de Gasto" },
          { id: 35, name: "Las Retribuciones e Indemnizaciones" },
          { id: 36, name: "Gastos para la Compra de Bienes y Servicios" },
          { id: 37, name: "Gestión Económica y Financiera" }
        ]
      },
      {
        id: 'block6',
        title: 'Bloque VI: Informática Básica y Ofimática',
        subtitle: '8 temas - Windows, Office, Internet',
        themes: [
          { id: 38, name: "Informática Básica" },
          { id: 39, name: "Sistema Operativo Windows" },
          { id: 40, name: "El Explorador de Windows" },
          { id: 41, name: "Procesadores de Texto: Word 365" },
          { id: 42, name: "Hojas de Cálculo: Excel 365" },
          { id: 43, name: "Bases de Datos: Access 365" },
          { id: 44, name: "Correo Electrónico: Outlook 365" },
          { id: 45, name: "La Red Internet" }
        ]
      }
    ]
  },

  // ========================================
  // AUXILIAR ADMINISTRATIVO DEL ESTADO (C2) - 16 temas
  // ========================================
  auxiliar_administrativo: {
    id: 'auxiliar_administrativo',
    name: 'Auxiliar Administrativo del Estado',
    shortName: 'AGE C2',
    slug: 'auxiliar-administrativo-estado',
    positionType: 'auxiliar_administrativo', // Valor para BD
    totalThemes: 16,
    themeBlocks: [
      {
        id: 'block1',
        title: 'Bloque I: Organización Pública',
        subtitle: '16 temas - Constitución, Procedimiento, Empleo Público',
        themes: [
          { id: 1, name: "La Constitución Española de 1978" },
          { id: 2, name: "El Tribunal Constitucional. La Corona" },
          { id: 3, name: "Las Cortes Generales" },
          { id: 4, name: "El Poder Judicial" },
          { id: 5, name: "El Gobierno y la Administración" },
          { id: 6, name: "El Gobierno Abierto. Agenda 2030" },
          { id: 7, name: "Ley 19/2013 de Transparencia" },
          { id: 8, name: "La Administración General del Estado" },
          { id: 9, name: "La Organización Territorial del Estado" },
          { id: 10, name: "La Organización de la Unión Europea" },
          { id: 11, name: "Las Leyes del Procedimiento Administrativo Común" },
          { id: 12, name: "La Protección de Datos Personales" },
          { id: 13, name: "El Personal Funcionario de las Administraciones Públicas" },
          { id: 14, name: "Derechos y Deberes de los Funcionarios" },
          { id: 15, name: "El Presupuesto del Estado en España" },
          { id: 16, name: "Políticas de Igualdad y contra la Violencia de Género" }
        ]
      }
    ]
  }
}

// ========================================
// FUNCIONES HELPER
// ========================================

/**
 * Obtiene la configuración de una oposición por su slug o positionType
 * @param {string} identifier - Puede ser slug ('administrativo-estado') o positionType ('administrativo_estado')
 * @returns {object|null} - Configuración de la oposición o null si no existe
 */
export function getOposicionConfig(identifier) {
  // Buscar por id/positionType directo
  if (OPOSICIONES_CONFIG[identifier]) {
    return OPOSICIONES_CONFIG[identifier]
  }

  // Buscar por slug
  const found = Object.values(OPOSICIONES_CONFIG).find(
    config => config.slug === identifier
  )

  return found || null
}

/**
 * Obtiene todos los temas de una oposición como lista plana
 * @param {string} identifier - slug o positionType de la oposición
 * @returns {Array} - Array de temas [{id, name}, ...]
 */
export function getAllThemes(identifier) {
  const config = getOposicionConfig(identifier)
  if (!config) return []

  return config.themeBlocks.flatMap(block => block.themes)
}

/**
 * Obtiene el nombre de un tema por su ID
 * @param {string} identifier - slug o positionType de la oposición
 * @param {number} themeId - ID del tema
 * @returns {string} - Nombre del tema o cadena vacía si no existe
 */
export function getThemeName(identifier, themeId) {
  const themes = getAllThemes(identifier)
  const theme = themes.find(t => t.id === themeId)
  return theme?.name || ''
}

/**
 * Obtiene los nombres de múltiples temas
 * @param {string} identifier - slug o positionType de la oposición
 * @param {number[]} themeIds - Array de IDs de temas
 * @returns {object} - Objeto {id: name, ...}
 */
export function getThemeNames(identifier, themeIds) {
  const themes = getAllThemes(identifier)
  const result = {}

  themeIds.forEach(id => {
    const theme = themes.find(t => t.id === id)
    if (theme) {
      result[id] = theme.name
    }
  })

  return result
}

/**
 * Obtiene la lista de oposiciones disponibles
 * @returns {Array} - Array de configuraciones básicas [{id, name, slug}, ...]
 */
export function getAvailableOposiciones() {
  return Object.values(OPOSICIONES_CONFIG).map(config => ({
    id: config.id,
    name: config.name,
    shortName: config.shortName,
    slug: config.slug,
    totalThemes: config.totalThemes
  }))
}

/**
 * Valida si una oposición existe
 * @param {string} identifier - slug o positionType
 * @returns {boolean}
 */
export function isValidOposicion(identifier) {
  return getOposicionConfig(identifier) !== null
}

/**
 * Convierte slug a positionType para queries a BD
 * @param {string} slug - El slug de la URL (ej: 'administrativo-estado')
 * @returns {string|null} - El positionType para la BD (ej: 'administrativo_estado')
 */
export function slugToPositionType(slug) {
  const config = getOposicionConfig(slug)
  return config?.positionType || null
}

/**
 * Convierte positionType a slug para URLs
 * @param {string} positionType - El positionType de la BD
 * @returns {string|null} - El slug para URLs
 */
export function positionTypeToSlug(positionType) {
  const config = getOposicionConfig(positionType)
  return config?.slug || null
}

// Exportar por defecto la configuración
export default OPOSICIONES_CONFIG
