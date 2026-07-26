/**
 * @jest-environment node
 */
// Tests del núcleo que decide si el epígrafe de un tema habla de la MATERIA que regulan
// los artículos escopados de una ley (T-117).
//
// Los casos "encaja" son REALES: salieron marcados en rojo por `audit:epigrafe` el 26/07 en
// `auxiliar_administrativo_diputacion_leon` y los tres eran falsos positivos — el epígrafe
// describe la materia sin citar la norma, que es como se redactan los temarios.

const {
  analizarMateria,
  palabrasClave,
  pareceCooficial,
} = require('@/lib/laws/epigrafeMateria')

// Fragmentos reales de la Ley 7/1985 (LBRL), abreviados.
const LBRL_ORGANOS_PROVINCIALES =
  'El Gobierno y la administración autónoma de la provincia corresponden a la Diputación u otras Corporaciones de carácter representativo. Son órganos de la Diputación el Presidente, los Vicepresidentes, la Junta de Gobierno y el Pleno. La constitución de las Diputaciones se realizará conforme a la legislación electoral. Corresponde en todo caso al Pleno la votación sobre la moción de censura al Presidente. El mandato corporativo finaliza en los términos previstos legalmente.'

const LBRL_MUNICIPIO =
  'El Municipio es la Entidad local básica de la organización territorial del Estado. Son elementos del Municipio el territorio, la población y la organización. La organización municipal responde a las siguientes reglas: el Alcalde, los Tenientes de Alcalde y el Pleno existen en todos los ayuntamientos. El Municipio ejercerá competencias propias en los términos de la legislación del Estado y de las Comunidades Autónomas.'

const TRLRHL_PRESUPUESTO =
  'Los presupuestos generales de las entidades locales constituyen la expresión cifrada, conjunta y sistemática de las obligaciones que, como máximo, pueden reconocer la entidad. El presupuesto general se aprobará inicialmente por el Pleno. Las modificaciones presupuestarias comprenden los créditos extraordinarios, los suplementos de crédito y las transferencias de crédito. La liquidación del presupuesto pondrá de manifiesto el remanente de tesorería.'

describe('epigrafeMateria — falsos positivos reales de audit:epigrafe (León, 26/07)', () => {
  // LÍMITE CONOCIDO Y MEDIDO, no un caso que "ya pasará". Con los artículos REALES de la
  // BD este epígrafe da 33% y sigue saliendo marcado. La causa es de vocabulario: casi
  // todas sus palabras clave ("composición", "atribuciones", "vigencia", "finalización",
  // "corporativo") son META — describen qué cubre el tema, no aparecen en el articulado.
  // Se deja fijado a propósito para que nadie baje el umbral hasta tragárselo: bajar
  // UMBRAL_DUDOSO por debajo de 0,33 haría pasar también a los que SÍ están fuera de tema.
  // Lo que se gana no es que desaparezca, es que ahora el aviso dice su porcentaje y se
  // adjudica en segundos. (En León: de 11 🔴 a 1 🔴.)
  it('caso límite: vocabulario meta → sigue marcado, y es correcto que lo esté', () => {
    const r = analizarMateria(
      'Órganos de gobierno provinciales: régimen de funcionamiento, composición, atribuciones, constitución, vigencia y finalización del mandato corporativo.',
      LBRL_ORGANOS_PROVINCIALES,
    )
    expect(r.banda).not.toBe('encaja')
    expect(r.ratio).toBeLessThan(0.6)
    expect(r.ratio).toBeGreaterThan(0) // algo casa: no es un disparate, es zona baja
  })

  it('"El Municipio y sus elementos" SÍ encaja', () => {
    const r = analizarMateria(
      'El Municipio y sus elementos. Organización y competencias de los municipios de régimen común.',
      LBRL_MUNICIPIO,
    )
    expect(r.banda).toBe('encaja')
  })

  it('"El presupuesto de las entidades locales" SÍ encaja con el Título VI del TRLRHL', () => {
    const r = analizarMateria(
      'El presupuesto de las entidades locales. Principios. Contenido y aprobación. Modificaciones presupuestarias. Ejecución y liquidación.',
      TRLRHL_PRESUPUESTO,
    )
    expect(r.banda).toBe('encaja')
  })
})

describe('epigrafeMateria — sigue cazando lo que SÍ está fuera de tema', () => {
  it('un epígrafe de prevención de riesgos NO encaja con articulado de presupuestos', () => {
    const r = analizarMateria(
      'Prevención de riesgos laborales: evaluación de riesgos, equipos de protección individual, vigilancia de la salud y formación preventiva de los trabajadores.',
      TRLRHL_PRESUPUESTO,
    )
    expect(r.banda).toBe('no_encaja')
  })

  it('un epígrafe de informática NO encaja con articulado de régimen local', () => {
    const r = analizarMateria(
      'Hojas de cálculo: fórmulas, funciones lógicas, gráficos y ordenación de datos en la hoja.',
      LBRL_MUNICIPIO,
    )
    expect(r.banda).toBe('no_encaja')
  })
})

describe('epigrafeMateria — lengua cooficial (falso positivo de otra clase)', () => {
  // Caso real 26/07: auxiliar_administrativo_diputacion_barcelona, epígrafe en catalán
  // contra el TRLRHL en castellano → 14% de solapamiento sin que el scope tenga nada malo.
  const EPI_CAT = 'Les hisendes locals i els seus pressupostos. Classificació dels ingressos i despeses.'

  it('detecta el epígrafe en lengua cooficial', () => {
    expect(pareceCooficial(EPI_CAT)).toBe(true)
    expect(pareceCooficial('El presupuesto de las entidades locales.')).toBe(false)
  })

  it('no lo da por fuera de tema: lo deja indeterminado con su motivo', () => {
    const r = analizarMateria(EPI_CAT, TRLRHL_PRESUPUESTO)
    expect(r.banda).toBe('indeterminado')
    expect(r.motivo).toMatch(/cooficial/)
  })

  it('pero si el solapamiento es alto, el idioma no se usa como excusa', () => {
    // Epígrafe con marcador catalán y contenido que sí casa → debe seguir siendo "encaja".
    const r = analizarMateria(
      'El Municipio i els seus elements. Organización, competencias, territorio y población municipal.',
      LBRL_MUNICIPIO,
    )
    expect(r.banda).toBe('encaja')
  })
})

describe('epigrafeMateria — casos degenerados', () => {
  it('epígrafe telegráfico (menos de 3 palabras clave) → indeterminado, no acusación', () => {
    const r = analizarMateria('El acto y sus fases.', LBRL_MUNICIPIO)
    expect(r.banda).toBe('indeterminado')
    expect(r.motivo).toMatch(/palabra/)
  })

  it('sin contenido escopado → indeterminado', () => {
    expect(analizarMateria('El presupuesto de las entidades locales.', '').banda).toBe('indeterminado')
  })

  it('descarta stopwords y palabras de menos de 5 letras', () => {
    const p = palabrasClave('El régimen general de los servicios públicos y las normas sobre ello')
    expect(p).not.toContain('regimen')
    expect(p).not.toContain('normas')
    expect(p.every((w) => w.length >= 5)).toBe(true)
  })

  it('el ratio informa aunque la banda sea la misma (para poder recalibrar)', () => {
    const r = analizarMateria('El Municipio y sus elementos. Organización municipal.', LBRL_MUNICIPIO)
    expect(r.ratio).toBeGreaterThan(0)
    expect(r.total).toBeGreaterThan(0)
    expect(r.halladas.length).toBeLessThanOrEqual(r.total)
  })
})
