const { esRubricaSucia, rubricaEsLimpiezaDe, numerosAmbiguos } = require('../../../lib/laws/rubricaSeccion')

// Todos los ejemplos son títulos REALES de `law_sections` medidos el 26/07/2026 (T-140):
// 50 de 2.048 secciones estaban contaminadas.

describe('esRubricaSucia', () => {
  it('detecta la nota de vigencia pegada al título (LOTC Título III)', () => {
    expect(esRubricaSucia('Título III. Del recurso de amparo constitucional Ténganse en cuenta los artículos 53.2')).toBe(true)
  })

  it('detecta la remisión editorial, en singular y en plural', () => {
    expect(esRubricaSucia('Título IV. De los conflictos constitucionales Véase el artículo 161')).toBe(true)
    expect(esRubricaSucia('Título VIII. Del personal al servicio del Tribunal Constitucional Véanse los artículos 43 y siguientes')).toBe(true)
  })

  it('detecta la nota de redacción (EA Canarias Título VIII)', () => {
    expect(esRubricaSucia('Título VIII. De la reforma del Estatuto Redactado conforme a la corrección de errores publicada')).toBe(true)
  })

  it('detecta el ENCABEZADO REPETIDO, que es la señal de rúbrica derogada', () => {
    // El regex viejo cogía la primera coincidencia del cuerpo crudo del bloque, que es la
    // redacción más ANTIGUA: aquí "Del control previo de inconstitucionalidad" está derogada
    // y la vigente es la que viene después del encabezado repetido.
    expect(esRubricaSucia('Título VI. Del control previo de inconstitucionalidad TÍTULO VI De la declaración sobre la constitucionalidad de los tratados internacionales')).toBe(true)
    // También sin tilde, que es como lo escriben las leyes de los 80.
    expect(esRubricaSucia('Título VIII. Haciendas Locales TITULO VIII Haciendas Locales Se deroga por la disposición derogatoria 1')).toBe(true)
  })

  it('NO marca una rúbrica limpia', () => {
    expect(esRubricaSucia('Título I. Del Tribunal Constitucional')).toBe(false)
    expect(esRubricaSucia('Capítulo II. Del régimen de la propiedad por pisos')).toBe(false)
    expect(esRubricaSucia('')).toBe(false)
    expect(esRubricaSucia(null)).toBe(false)
  })

  it('no confunde una rúbrica que MENCIONA un título con el encabezado repetido', () => {
    // Un solo "Título" en el texto no basta: el patrón exige dos encabezados.
    expect(esRubricaSucia('Título V. Del Título competencial y su alcance')).toBe(false)
  })
})

// ── EL INVARIANTE DE SEGURIDAD DEL REPARADOR ──
// El blockId de cada sección se recupera casando el `section_number` guardado con el índice
// actual del BOE, y ese emparejamiento PUEDE fallar. Si falla, escribiríamos en una sección
// la rúbrica de otra: destruir un dato correcto para "arreglarlo". Exigir que la rúbrica del
// BOE esté ya CONTENIDA en el título guardado hace que la reparación solo pueda acortar o
// seleccionar lo que ya había.
describe('rubricaEsLimpiezaDe — la reparación solo limpia, nunca reemplaza', () => {
  it('acepta quitar la nota de vigencia (la rúbrica ya estaba dentro)', () => {
    expect(rubricaEsLimpiezaDe(
      'Título III. Del recurso de amparo constitucional Ténganse en cuenta los artículos 53.2',
      'Del recurso de amparo constitucional',
    )).toBe(true)
  })

  it('acepta rescatar la rúbrica VIGENTE que venía tras el encabezado repetido', () => {
    expect(rubricaEsLimpiezaDe(
      'Título VI. Del control previo de inconstitucionalidad TÍTULO VI De la declaración sobre la constitucionalidad de los tratados internacionales',
      'De la declaración sobre la constitucionalidad de los tratados internacionales',
    )).toBe(true)
  })

  it('RECHAZA una rúbrica que no está en el título guardado (caso real de la LOPJ)', () => {
    // Sección mal emparejada: sin esta guarda se habría sobrescrito un título correcto.
    expect(rubricaEsLimpiezaDe(
      'Título IV. De la fe pública judicial y de la documentación TÍTULO IV De la fe pública judicial y de la documentación',
      'De los órganos del Consejo General del Poder Judicial',
    )).toBe(false)
  })

  it('RECHAZA cuando la rúbrica del BOE es más LARGA que lo guardado (RD 375/2003)', () => {
    // Caso real: el BOE añade "y durante la lactancia natural", que no está en nuestro
    // título. Puede ser una reforma legítima, pero NO es una limpieza → revisión humana.
    expect(rubricaEsLimpiezaDe(
      'Capítulo VI. Prestaciones por incapacidad temporal y por riesgo durante el embarazo',
      'Prestaciones por incapacidad temporal y por riesgo durante el embarazo y durante la lactancia natural',
    )).toBe(false)
  })

  it('compara ignorando tildes y espaciado (los 80 escriben "TITULO" sin tilde)', () => {
    expect(rubricaEsLimpiezaDe('Título VIII.  Haciendas   Locales TITULO VIII Haciendas Locales', 'Haciendas Locales')).toBe(true)
  })

  it('rechaza entradas vacías', () => {
    expect(rubricaEsLimpiezaDe('Título I. Algo', '')).toBe(false)
    expect(rubricaEsLimpiezaDe('', 'Algo')).toBe(false)
  })
})

describe('numerosAmbiguos — leyes de nivel LIBRO', () => {
  it('detecta números repetidos (títulos que reinician por libro)', () => {
    expect(numerosAmbiguos([{ num: 'I' }, { num: 'II' }, { num: 'I' }])).toBe(true)
  })

  it('no marca una numeración única', () => {
    expect(numerosAmbiguos([{ num: 'Preliminar' }, { num: 'I' }, { num: 'II' }])).toBe(false)
  })

  it('tolera entradas vacías', () => {
    expect(numerosAmbiguos([])).toBe(false)
    expect(numerosAmbiguos(null)).toBe(false)
  })
})
