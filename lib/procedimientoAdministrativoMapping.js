// lib/procedimientoAdministrativoMapping.js
// Mapeo de secciones de procedimiento administrativo a leyes y artículos específicos

// Mapeo de cada sección a los artículos específicos de las leyes
export const PROCEDIMIENTO_MAPPING = {
  'conceptos-generales': {
    name: 'Conceptos Generales',
    description: 'Principios generales, capacidad de obrar y conceptos fundamentales del procedimiento administrativo común',
    laws: {
      'Ley 39/2015': {
        articles: ['1', '2', '3', '4', '5', '6', '7', '8'],
        description: 'Ámbito de aplicación, principios de actuación y derechos de los ciudadanos'
      },
      'Ley 40/2015': {
        articles: ['1', '2', '3'],
        description: 'Principios del sector público y buen gobierno'
      },
      'CE': {
        articles: ['103', '105', '106'],
        description: 'Principios constitucionales de la Administración Pública'
      }
    }
  },
  
  'el-procedimiento-administrativo': {
    name: 'El Procedimiento Administrativo',
    description: 'Fases del procedimiento: iniciación, ordenación, instrucción y finalización',
    laws: {
      'Ley 39/2015': {
        articles: ['52', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '90', '91', '92', '93', '94', '95'],
        description: 'Disposiciones generales sobre el procedimiento administrativo'
      }
    }
  },
  
  'responsabilidad-patrimonial': {
    name: 'La Responsabilidad Patrimonial',
    description: 'Responsabilidad patrimonial de las Administraciones Públicas',
    laws: {
      'Ley 40/2015': {
        articles: ['32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
        description: 'Responsabilidad patrimonial del sector público'
      },
      'CE': {
        articles: ['106'],
        description: 'Responsabilidad de la Administración y control jurisdiccional'
      }
    }
  },
  
  'terminos-plazos': {
    name: 'Términos y Plazos',
    description: 'Cómputo de plazos, términos y calendario administrativo',
    laws: {
      'Ley 39/2015': {
        articles: ['30', '31', '32'],
        description: 'Cómputo de plazos y términos'
      }
    }
  },
  
  'actos-administrativos': {
    name: 'De los Actos Administrativos',
    description: 'Concepto, elementos y clases de actos administrativos',
    laws: {
      'Ley 39/2015': {
        articles: ['33', '34', '35', '36', '37', '38', '39', '40', '41'],
        description: 'Conceptos, requisitos y forma de los actos administrativos'
      }
    }
  },
  
  'eficacia-validez-actos': {
    name: 'Eficacia y Validez de los Actos Administrativos',
    description: 'Eficacia, suspensión, revocación y rectificación de actos',
    laws: {
      'Ley 39/2015': {
        articles: ['38', '39', '40', '41'],
        description: 'Eficacia, suspensión y ejecutividad de los actos administrativos'
      }
    }
  },
  
  'nulidad-anulabilidad': {
    name: 'Nulidad y Anulabilidad',
    description: 'Nulidad de pleno derecho y anulabilidad de los actos administrativos',
    laws: {
      'Ley 39/2015': {
        articles: ['47', '48', '49', '50', '51'],
        description: 'Nulidad de pleno derecho y anulabilidad'
      }
    }
  },
  
  'revision-oficio': {
    name: 'Revisión de Oficio',
    description: 'Revisión de los actos en vía administrativa',
    laws: {
      'Ley 39/2015': {
        articles: ['106', '107', '108', '109', '110', '111'],
        description: 'Revisión de oficio de disposiciones y actos nulos'
      }
    }
  },
  
  'recursos-administrativos': {
    name: 'Los Recursos Administrativos',
    description: 'Recurso de alzada, reposición y recurso extraordinario de revisión',
    laws: {
      'Ley 39/2015': {
        articles: ['112', '113', '114', '115', '116', '117', '118', '119', '120', '121', '122', '123', '124', '125', '126', '127'],
        description: 'Recursos de alzada, reposición y extraordinario de revisión'
      }
    }
  },
  
  'jurisdiccion-contencioso': {
    name: 'La Jurisdicción Contencioso Administrativo',
    description: 'Principios y regulación de la jurisdicción contencioso-administrativa',
    laws: {
      'CE': {
        articles: ['106'],
        description: 'Control jurisdiccional de la Administración'
      }
    }
  },

  'ejecucion': {
    name: 'El Procedimiento Administrativo: Ejecución',
    description: 'Estudio específico de la ejecución de actos administrativos, ejecutoriedad, medios de ejecución forzosa y procedimientos ejecutivos según la Ley 39/2015',
    laws: {
      'Ley 39/2015': {
        articles: ['96', '98', '101', '102', '104'],
        description: 'Ejecución de actos administrativos y procedimientos ejecutivos'
      }
    }
  },

  'finalizacion-procedimiento': {
    name: 'El Procedimiento Administrativo: Finalización del Procedimiento',
    description: 'Estudio específico de la finalización del procedimiento administrativo: terminación convencional, actuaciones complementarias, resolución y aspectos especiales según la Ley 39/2015',
    laws: {
      'Ley 39/2015': {
        articles: ['84', '85', '86', '87', '88', '89', '90', '92', '93', '95'],
        description: 'Finalización del procedimiento administrativo y sus modalidades'
      }
    }
  },

  'garantias': {
    name: 'Procedimiento Administrativo: Garantías',
    description: 'Estudio específico de las garantías del procedimiento administrativo: derechos de los interesados, pluralidad, iniciación, medidas provisionales y aspectos procedimentales según la Ley 39/2015',
    laws: {
      'Ley 39/2015': {
        articles: ['3', '4', '5', '7', '53', '54', '55', '56', '57', '58', '59', '60', '61', '62', '63', '64', '66', '68', '69', '98'],
        description: 'Garantías y derechos en el procedimiento administrativo'
      }
    }
  },

  'instruccion': {
    name: 'Procedimiento Administrativo: Instrucción',
    description: 'Estudio específico de la fase de instrucción del procedimiento administrativo: actos de instrucción, alegaciones, prueba, informes, audiencia e información pública según la Ley 39/2015',
    laws: {
      'Ley 39/2015': {
        articles: ['75', '76', '77', '79', '80', '81', '82', '83'],
        description: 'Fase de instrucción del procedimiento administrativo'
      }
    }
  },

  'ordenacion': {
    name: 'Procedimiento Administrativo: Ordenación del procedimiento administrativo',
    description: 'Estudio específico de la fase de ordenación del procedimiento administrativo: expediente administrativo, principios de instrucción, simplificación del procedimiento y cumplimiento de trámites según la Ley 39/2015',
    laws: {
      'Ley 39/2015': {
        articles: ['70', '71', '72', '73'],
        description: 'Ordenación del procedimiento administrativo'
      }
    }
  }
}

// Función para obtener el mapeo de una sección específica
export function getSectionMapping(sectionSlug) {
  return PROCEDIMIENTO_MAPPING[sectionSlug] || null
}

// Función para obtener todos los artículos de una sección
export function getSectionArticles(sectionSlug) {
  const mapping = getSectionMapping(sectionSlug)
  if (!mapping) return []
  
  const articles = []
  Object.entries(mapping.laws).forEach(([lawShortName, lawData]) => {
    lawData.articles.forEach(articleNumber => {
      articles.push({
        lawShortName,
        articleNumber,
        description: lawData.description
      })
    })
  })
  
  return articles
}

// Función para obtener estadísticas de una sección
export function getSectionStats(sectionSlug) {
  const mapping = getSectionMapping(sectionSlug)
  if (!mapping) return { articlesCount: 0, lawsCount: 0 }
  
  const lawsCount = Object.keys(mapping.laws).length
  const articlesCount = Object.values(mapping.laws)
    .reduce((total, lawData) => total + lawData.articles.length, 0)
  
  return { articlesCount, lawsCount }
}

// Función para obtener todas las leyes usadas en procedimiento administrativo
export function getProcedimientoLaws() {
  const laws = new Set()
  
  Object.values(PROCEDIMIENTO_MAPPING).forEach(section => {
    Object.keys(section.laws).forEach(lawShortName => {
      laws.add(lawShortName)
    })
  })
  
  return Array.from(laws)
}

// Validar si una sección es válida
export function isValidSection(sectionSlug) {
  return Object.keys(PROCEDIMIENTO_MAPPING).includes(sectionSlug)
}