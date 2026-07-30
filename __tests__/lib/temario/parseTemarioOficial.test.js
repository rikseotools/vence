// __tests__/lib/temario/parseTemarioOficial.test.js
//
// El parser cuya salida usa la guarda de literalidad (`epigrafeApply.js`) como "lo que dice el
// boletín". Si deja basura del marcador pegada al epígrafe, la guarda rechaza reescrituras
// legítimas de la oposición ENTERA y empuja a declararlo todo como fuente "a mano" — que es la
// vía reservada a los boletines no parseables. Sin BD.

const { parseTemas, limpiarSeparador } = require('../../../lib/temario/parseTemarioOficial')

describe('limpiarSeparador — el separador del marcador no es contenido', () => {
  test.each([
    ['.- La Ley 9/2017, de 8 de noviembre', 'La Ley 9/2017, de 8 de noviembre'],
    ['.– El Estatuto de Autonomía', 'El Estatuto de Autonomía'],
    ['.-La Constitución', 'La Constitución'],
    [': La comunicación en la organización', 'La comunicación en la organización'],
    ['- Los documentos administrativos', 'Los documentos administrativos'],
    ['. Informática básica', 'Informática básica'],
    ['   La Ley 39/2015', 'La Ley 39/2015'],
  ])('%p → %p', (entrada, esperado) => {
    expect(limpiarSeparador(entrada)).toBe(esperado)
  })

  test('no se come contenido que empiece por letra o número', () => {
    expect(limpiarSeparador('.- 2026: el año de la reforma')).toBe('2026: el año de la reforma')
  })

  test('tolera null/undefined', () => {
    expect(limpiarSeparador(null)).toBe('')
    expect(limpiarSeparador(undefined)).toBe('')
  })
})

describe('parseTemas — caso real BORM nº 233/2021 (Auxiliar Administrativo del SMS)', () => {
  // Formato "TEMA N.- ", el de la mayoría de boletines autonómicos.
  const borm = [
    'TEMA 20.- La Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público (I). Ámbito de aplicación.',
    'TEMA 21.- La Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público (II). Funcionamiento electrónico.',
    'TEMA 22.- La Ley 9/2017, de 8 de noviembre, de Contratos del Sector Público. Objeto y ámbito de aplicación.',
    'TEMA 23.- Los documentos administrativos: Concepto, funciones y clases.',
  ].join('\n')

  test('el epígrafe empieza por su primera palabra, no por el separador', () => {
    const t = parseTemas(borm)
    // El bug: sin limpiar, esto valía ".- La Ley 9/2017…" y la guarda lo daba por NO literal.
    expect(t[22]).toBe('La Ley 9/2017, de 8 de noviembre, de Contratos del Sector Público. Objeto y ámbito de aplicación.')
    expect(t[20].startsWith('La Ley 40/2015')).toBe(true)
    expect(t[23]).toBe('Los documentos administrativos: Concepto, funciones y clases.')
  })

  test('ningún epígrafe arranca con un carácter de puntuación', () => {
    for (const [n, txt] of Object.entries(parseTemas(borm))) {
      expect(`T${n}: ${txt}`).toEqual(expect.not.stringMatching(/^T\d+: [.\-–—:;)]/))
    }
  })
})

describe('parseTemas — reglas de troceo', () => {
  test('menos de 3 marcadores no es un temario (evita el ruido de "sobre este tema…")', () => {
    expect(parseTemas('Sobre este tema 1 la comisión resolverá. Ver tema 2.')).toEqual({})
  })

  test('con índice + cuerpo desarrollado, gana el texto MÁS LARGO', () => {
    const doc = [
      'ÍNDICE', 'Tema 1.- Constitución', 'Tema 2.- Estatuto', 'Tema 3.- Hacienda',
      'DESARROLLO',
      'Tema 1.- La Constitución española de 1978: estructura, contenido y principios.',
      'Tema 2.- El Estatuto de Autonomía: órganos institucionales y régimen jurídico.',
      'Tema 3.- La Ley de Hacienda: principios generales y presupuestos.',
    ].join('\n')
    expect(parseTemas(doc)[1]).toBe('La Constitución española de 1978: estructura, contenido y principios.')
  })

  test('cada tema acaba donde empieza el siguiente', () => {
    const t = parseTemas('Tema 1.- Uno. Tema 2.- Dos. Tema 3.- Tres.')
    expect(t[1]).toBe('Uno.')
    expect(t[2]).toBe('Dos.')
  })

  test('el último tema se corta para no arrastrar el resto del documento', () => {
    const cola = 'x'.repeat(3000)
    const t = parseTemas(`Tema 1.- Uno. Tema 2.- Dos. Tema 3.- ${cola}`)
    expect(t[3].length).toBeLessThanOrEqual(1000)
  })

  test('acepta mayúsculas, minúsculas y varios espacios en el marcador', () => {
    const t = parseTemas('TEMA  1.- Uno.\ntema 2.- Dos.\nTema 3.- Tres.')
    expect(Object.keys(t).sort()).toEqual(['1', '2', '3'])
  })
})
