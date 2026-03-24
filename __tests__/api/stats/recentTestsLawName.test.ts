// __tests__/api/stats/recentTestsLawName.test.ts
// Verifica que los tests de leyes muestran el nombre de la ley (no "Test Aleatorio")

describe('Recent tests — law name display logic', () => {
  // Simula la lógica de page.tsx para generar el título
  function getTestTitle(
    temaNumber: number | null,
    topicTitle: string | null,
    lawName: string | null,
    rawTitle: string
  ): string {
    const bloquePrefix = temaNumber ? `Tema ${temaNumber}` : null

    if (temaNumber) {
      return topicTitle ? `${bloquePrefix}: ${topicTitle}` : bloquePrefix!
    }

    if (lawName) {
      return `Test ${lawName}`
    }

    if (rawTitle && !rawTitle.includes('Test Tema')) {
      return rawTitle
    }

    return 'Test Aleatorio'
  }

  test('test de ley con lawName muestra "Test Ley 39/2015"', () => {
    expect(getTestTitle(0, null, 'Ley 39/2015', 'Test Tema 0 - 4')).toBe('Test Ley 39/2015')
  })

  test('test de CE con lawName muestra "Test CE"', () => {
    expect(getTestTitle(0, null, 'CE', 'Test Tema 0 - 4')).toBe('Test CE')
  })

  test('test de tema con temaNumber muestra el tema (no la ley)', () => {
    expect(getTestTitle(7, 'La Jurisdicción Contencioso-Administrativa', 'Ley 39/2015', 'Test Tema 7 - 99')).toBe(
      'Tema 7: La Jurisdicción Contencioso-Administrativa'
    )
  })

  test('test de tema sin topicTitle muestra solo bloque', () => {
    expect(getTestTitle(7, null, 'Ley 39/2015', 'Test Tema 7 - 99')).toBe('Tema 7')
  })

  test('test sin tema ni ley muestra Test Aleatorio', () => {
    expect(getTestTitle(0, null, null, 'Test Tema 0 - 4')).toBe('Test Aleatorio')
  })

  test('test sin tema ni ley pero con título descriptivo lo muestra', () => {
    expect(getTestTitle(0, null, null, 'Examen Oficial 2020-01-01 (unica parte) - tramitacion-procesal')).toBe(
      'Examen Oficial 2020-01-01 (unica parte) - tramitacion-procesal'
    )
  })

  test('temaNumber=null con lawName muestra la ley', () => {
    expect(getTestTitle(null, null, 'Ley 40/2015', 'Test Tema 0')).toBe('Test Ley 40/2015')
  })

  test('temaNumber=0 es falsy, cae al lawName', () => {
    // 0 es falsy en JS
    expect(getTestTitle(0, null, 'LO 3/2018', 'Test Tema 0 - 1')).toBe('Test LO 3/2018')
  })

  test('psicotécnico sin ley muestra título original', () => {
    expect(getTestTitle(0, null, null, 'Capacidad ortográfica')).toBe('Capacidad ortográfica')
  })

  test('test con título vacío y sin ley muestra Test Aleatorio', () => {
    expect(getTestTitle(0, null, null, 'Test Tema 0 - 1')).toBe('Test Aleatorio')
  })
})
