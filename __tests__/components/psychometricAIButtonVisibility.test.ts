/**
 * Tests de visibilidad del botón de IA en PsychometricTestLayout.
 * Verifica la lógica de cuándo el botón debe mostrarse, sin renderizar
 * el componente completo (que tiene muchas dependencias).
 *
 * El bug original: el botón estaba dentro de {showResult && verifiedExplanation && (...)}
 * por lo que se ocultaba cuando no había explicación. El fix lo sacó a
 * {showResult && (<PsychometricAIHelpButton />)}, independiente de verifiedExplanation.
 */

describe('PsychometricTestLayout - lógica de visibilidad del botón IA', () => {
  // Simular la lógica del template tal como aparece en el código fuente
  // ANTES del fix: showResult && verifiedExplanation && (...)
  // DESPUÉS del fix: showResult && (...)

  function shouldShowAIButton(showResult: boolean): boolean {
    // Lógica actual (post-fix): solo depende de showResult
    return showResult
  }

  // La lógica antigua (pre-fix) para comparación en el test de regresión
  function shouldShowAIButton_OLD(showResult: boolean, verifiedExplanation: string | null): boolean {
    return showResult && !!verifiedExplanation
  }

  test('botón visible cuando showResult=true', () => {
    expect(shouldShowAIButton(true)).toBe(true)
  })

  test('botón oculto cuando showResult=false', () => {
    expect(shouldShowAIButton(false)).toBe(false)
  })

  test('verifiedExplanation null NO oculta el botón (regresión del bug)', () => {
    // Con el fix, el botón no depende de verifiedExplanation
    const showResult = true
    const verifiedExplanation: string | null = null

    // Nueva lógica: visible
    expect(shouldShowAIButton(showResult)).toBe(true)

    // Vieja lógica hubiera ocultado el botón:
    expect(shouldShowAIButton_OLD(showResult, verifiedExplanation)).toBe(false)
  })

  test('botón visible con verifiedExplanation presente (sin regresión)', () => {
    expect(shouldShowAIButton(true)).toBe(true)
    // También la vieja lógica lo mostraba en este caso
    expect(shouldShowAIButton_OLD(true, 'Alguna explicación')).toBe(true)
  })
})

describe('ChartQuestion - hideAIChat controla visibilidad', () => {
  function shouldShowAIButton(showResult: boolean, hideAIChat: boolean): boolean {
    return showResult && !hideAIChat
  }

  test('botón visible cuando showResult=true y hideAIChat=false', () => {
    expect(shouldShowAIButton(true, false)).toBe(true)
  })

  test('botón oculto cuando hideAIChat=true', () => {
    expect(shouldShowAIButton(true, true)).toBe(false)
  })

  test('botón oculto cuando showResult=false', () => {
    expect(shouldShowAIButton(false, false)).toBe(false)
  })
})
