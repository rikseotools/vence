/**
 * Guarda del escritor de epígrafes (`verify:epigrafe apply`).
 *
 * Cada caso reproduce un fallo REAL o el escenario que lo habría evitado:
 *   · los 4 campos → fallo Cantabria 08/07/2026 (se olvidó `descripcion_corta`)
 *   · literalidad  → Cantabria 27/07/2026 (epígrafes escritos "a ojo": versión correcta
 *     pero faltaban materias del programa vigente — navegadores, Recortes, Snap Layouts)
 *   · display drift → misma definición que el detector nocturno, aplicada ANTES de escribir
 */
const { validarPlanEpigrafe, normalizarLiteral, esLiteral, CAMPOS } = require('../../lib/temario/epigrafeApply.js')

const OFICIAL_T20 =
  'Explorador de Archivos en Windows 11. Gestión básica de carpetas y archivos. Buscador mejorado y acceso rápido. ' +
  'Impresión de documentos y configuración de dispositivos (impresoras, escáneres). Herramienta Recortes y anotaciones ' +
  '(Snipping Tool renovada). Navegadores Google Chrome y Microsoft Edge: favoritos, historial, búsqueda, certificados personales.'

const temaValido = (over = {}) => ({
  title: 'El Explorador de Archivos en Windows 11',
  epigrafe: OFICIAL_T20,
  description: OFICIAL_T20,
  descripcion_corta: 'Explorador de Windows 11: carpetas, búsqueda, impresión, Recortes y navegadores.',
  ...over,
})

describe('validarPlanEpigrafe', () => {
  test('acepta un tema con los 4 campos y el epígrafe literal', () => {
    const r = validarPlanEpigrafe({ 20: temaValido() }, { 20: OFICIAL_T20 })
    expect(r.errores).toEqual([])
    expect(r.ok).toEqual(['20'])
  })

  test.each(CAMPOS)('rechaza si falta el campo %s (fallo Cantabria 08/07/2026)', (campo) => {
    const t = temaValido()
    delete t[campo]
    const r = validarPlanEpigrafe({ 20: t }, { 20: OFICIAL_T20 })
    expect(r.ok).toEqual([])
    expect(r.errores.some((e) => e.code === 'campo_faltante' && e.detail.includes(campo))).toBe(true)
  })

  test('rechaza el campo vacío o solo espacios (no basta con que exista la clave)', () => {
    const r = validarPlanEpigrafe({ 20: temaValido({ descripcion_corta: '   ' }) }, { 20: OFICIAL_T20 })
    expect(r.errores.some((e) => e.code === 'campo_faltante')).toBe(true)
  })

  test('rechaza una PARÁFRASIS fiel en el tono pero infiel en el alcance', () => {
    // Es el caso real: suena bien, es de la versión correcta… y se ha comido los
    // navegadores, la herramienta Recortes y la configuración de dispositivos.
    const parafrasis = 'El Explorador de Archivos en Windows 11. Gestión de carpetas y archivos. El Buscador de Archivos y Aplicaciones. La impresión de documentos.'
    const r = validarPlanEpigrafe({ 20: temaValido({ epigrafe: parafrasis }) }, { 20: OFICIAL_T20 })
    expect(r.ok).toEqual([])
    expect(r.errores.some((e) => e.code === 'epigrafe_no_literal')).toBe(true)
  })

  test('no escribe si no hay texto oficial de ese tema (sin fuente no se escribe)', () => {
    const r = validarPlanEpigrafe({ 20: temaValido() }, {})
    expect(r.errores.some((e) => e.code === 'sin_oficial')).toBe(true)
  })

  test('caza el drift de versión ANTES de escribir, no la noche siguiente', () => {
    const r = validarPlanEpigrafe(
      { 20: temaValido({ descripcion_corta: 'Explorador de Windows 10: carpetas y búsqueda.' }) },
      { 20: OFICIAL_T20 })
    expect(r.errores.some((e) => e.code === 'display_drift' && e.detail.includes('WIN_VER_DRIFT'))).toBe(true)
  })

  test('caza el APP_DRIFT del fallo real (tema de Excel con descripción de Word)', () => {
    const oficial = 'Hoja de cálculo: Microsoft Excel (Microsoft 365). Conceptos básicos: libros, hojas, celdas.'
    const r = validarPlanEpigrafe({
      22: {
        title: 'Hoja de cálculo: Microsoft Excel (Microsoft 365)',
        epigrafe: oficial,
        description: oficial,
        descripcion_corta: 'Word (Microsoft 365): tablas, plantillas, correspondencia.',
      },
    }, { 22: oficial })
    expect(r.errores.some((e) => e.code === 'display_drift' && e.detail.includes('APP_DRIFT'))).toBe(true)
  })

  test('un tema inválido no arrastra a los demás: informa de todos y solo aprueba los limpios', () => {
    const oficial21 = 'Procesador de textos: Microsoft Word (Microsoft 365). Principales funciones.'
    const r = validarPlanEpigrafe({
      20: temaValido(),
      21: { title: 'Word', epigrafe: 'otra cosa', description: 'x', descripcion_corta: 'y' },
    }, { 20: OFICIAL_T20, 21: oficial21 })
    expect(r.ok).toEqual(['20'])
    expect(r.errores.every((e) => e.tema === '21')).toBe(true)
  })
})

describe('normalizarLiteral / esLiteral', () => {
  test('el ruido tipográfico del PDF del boletín NO es un cambio de texto', () => {
    const boletin = 'Gestión básica de  carpetas y archivos.  '
    const nuestro = 'Gestión básica de carpetas y archivos.'
    expect(esLiteral(nuestro, boletin)).toBe(true)
  })

  test('las comillas angulares y las rectas convergen', () => {
    expect(normalizarLiteral('el «acto» administrativo')).toBe(normalizarLiteral('el "acto" administrativo'))
  })

  test('una palabra de diferencia SÍ rompe la literalidad', () => {
    expect(esLiteral('Gestión de carpetas y archivos.', 'Gestión básica de carpetas y archivos.')).toBe(false)
  })

  test('sin oficial nunca es literal (no se cuela por el hueco del null)', () => {
    expect(esLiteral('lo que sea', null)).toBe(false)
    expect(esLiteral('lo que sea', '')).toBe(false)
  })
})

describe('resolverFuentes — de dónde sale el texto oficial', () => {
  const { resolverFuentes } = require('../../lib/temario/epigrafeApply.js')
  const manual = (t) => ({ oficial: t, oficial_manual: true, source_url: 'https://boletin/x.pdf' })

  test('sin parseo automático, vale el manual acreditado (source_url + oficial_manual)', () => {
    const r = resolverFuentes({ 1: manual('Texto oficial') }, {}, {})
    expect(r.oficiales['1']).toBe('Texto oficial')
    expect(r.manuales).toEqual(['1'])
    expect(r.conflictos).toEqual([])
  })

  test('un `oficial` SIN acreditar (sin source_url) no se acepta: sería autocertificación', () => {
    const r = resolverFuentes({ 1: { oficial: 'me lo invento', oficial_manual: true } }, {}, {})
    expect(r.oficiales['1']).toBeUndefined()
  })

  test('si el parseo automático existe y NO hay manual, manda el automático', () => {
    const r = resolverFuentes({ 1: {} }, { 1: 'Del boletín' }, {})
    expect(r.oficiales['1']).toBe('Del boletín')
    expect(r.manuales).toEqual([])
  })

  test('coinciden salvo ruido tipográfico → no es conflicto', () => {
    const r = resolverFuentes({ 1: manual('La  Constitución española.') }, { 1: 'La Constitución española. ' }, {})
    expect(r.conflictos).toEqual([])
    expect(r.oficiales['1']).toBeDefined()
  })

  test('DISCREPAN de verdad → conflicto, y NO se elige por nadie (caso tcae_galicia)', () => {
    // El parser mezcló el bloque del turno de discapacidad: su "T3" es otro tema.
    const r = resolverFuentes(
      { 3: manual('La Ley general de sanidad: fundamentos y características.') },
      { 3: 'Legislación sanitaria: derechos y deberes de los usuarios.' }, {})
    expect(r.conflictos).toHaveLength(1)
    expect(r.conflictos[0].tema).toBe('3')
    expect(r.oficiales['3']).toBeUndefined()
  })

  test('con --fuente-manual el conflicto se resuelve a favor del humano, y queda anotado', () => {
    const r = resolverFuentes(
      { 3: manual('La Ley general de sanidad: fundamentos y características.') },
      { 3: 'Legislación sanitaria: derechos y deberes de los usuarios.' }, { fuenteManual: true })
    expect(r.conflictos).toEqual([])
    expect(r.oficiales['3']).toMatch(/Ley general de sanidad/)
    expect(r.manuales).toEqual(['3'])
  })
})
