// __tests__/components/QuestionEvolution.test.ts
//
// Tests de los helpers puros de QuestionEvolution (migrado a .tsx 15/4/2026
// con soporte blanco). Testean la lógica de clasificación, rachas,
// transiciones de evolución y cálculos agregados.
//
// NO montan el componente React (demasiados mocks de supabase) — testean
// los helpers exportados que contienen toda la lógica de negocio.

// Mock de supabase para no disparar el cliente real al importar el módulo
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }) }),
  }),
}))

import {
  clasificarIntento,
  calcularRachaMaximaCorrecta,
  calcularRachaMaximaIncorrecta,
  determinarTipoEvolucion,
  calcularEvolucionCompleta,
} from '@/components/QuestionEvolution'

// Helper para construir un HistoryEntry mínimo
let __idCounter = 0
function mkEntry(opts: { correct: boolean; blank?: boolean; at?: string; time?: number; conf?: string | null }): any {
  return {
    id: `id-${++__idCounter}`,
    user_answer: opts.blank ? 'BLANK' : opts.correct ? 'A' : 'B',
    correct_answer: 'A',
    is_correct: opts.correct,
    was_blank: opts.blank ?? false,
    confidence_level: opts.conf ?? null,
    time_spent_seconds: opts.time ?? 5,
    created_at: opts.at ?? '2026-01-01T00:00:00Z',
    test_id: 'test-1',
    question_order: 1,
    tests: null,
  }
}

describe('clasificarIntento — 3 estados (correct / incorrect / blank)', () => {
  test('correct: is_correct=true, was_blank=false → correct', () => {
    expect(clasificarIntento({ is_correct: true, was_blank: false })).toBe('correct')
  })
  test('correct con was_blank undefined (legacy) → correct', () => {
    expect(clasificarIntento({ is_correct: true })).toBe('correct')
  })
  test('incorrect: is_correct=false, was_blank=false → incorrect', () => {
    expect(clasificarIntento({ is_correct: false, was_blank: false })).toBe('incorrect')
  })
  test('blank: was_blank=true → blank (aunque is_correct venga como false)', () => {
    expect(clasificarIntento({ is_correct: false, was_blank: true })).toBe('blank')
  })
  test('blank prevalece: was_blank=true gana aunque is_correct=true (no debería pasar)', () => {
    // Defensa: si la BD tiene una fila inconsistente, priorizamos was_blank
    expect(clasificarIntento({ is_correct: true, was_blank: true })).toBe('blank')
  })
})

describe('calcularRachaMaximaCorrecta — blanco NO rompe racha', () => {
  test('sin historial: racha = 0', () => {
    expect(calcularRachaMaximaCorrecta([])).toBe(0)
  })
  test('3 correctas seguidas: racha = 3', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
    ]
    expect(calcularRachaMaximaCorrecta(h)).toBe(3)
  })
  test('correcta, fallo, correcta: racha = 1', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false }),
      mkEntry({ correct: true }),
    ]
    expect(calcularRachaMaximaCorrecta(h)).toBe(1)
  })
  test('CRÍTICO: correcta, BLANCO, correcta → racha = 2 (blanco NO rompe)', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: true }),
    ]
    expect(calcularRachaMaximaCorrecta(h)).toBe(2)
  })
  test('múltiples blancos intercalados: racha sigue intacta', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: true }),
    ]
    expect(calcularRachaMaximaCorrecta(h)).toBe(3)
  })
  test('solo blancos: racha = 0 (ninguna correcta)', () => {
    const h = [mkEntry({ correct: false, blank: true }), mkEntry({ correct: false, blank: true })]
    expect(calcularRachaMaximaCorrecta(h)).toBe(0)
  })
  test('fallo real sí rompe: ✓ ✓ ✗ ✓ → racha = 2', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: false }),
      mkEntry({ correct: true }),
    ]
    expect(calcularRachaMaximaCorrecta(h)).toBe(2)
  })
})

describe('calcularRachaMaximaIncorrecta — solo fallos reales (blanco no cuenta)', () => {
  test('3 fallos seguidos: racha = 3', () => {
    const h = Array.from({ length: 3 }, () => mkEntry({ correct: false }))
    expect(calcularRachaMaximaIncorrecta(h)).toBe(3)
  })
  test('fallo, blanco, fallo → racha = 2 (blanco no rompe fallos)', () => {
    const h = [
      mkEntry({ correct: false }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: false }),
    ]
    expect(calcularRachaMaximaIncorrecta(h)).toBe(2)
  })
  test('solo blancos: racha incorrecta = 0 (blanco NO es fallo real)', () => {
    const h = Array.from({ length: 3 }, () => mkEntry({ correct: false, blank: true }))
    expect(calcularRachaMaximaIncorrecta(h)).toBe(0)
  })
  test('correcta en medio sí rompe: ✗ ✓ ✗ → racha incorrecta = 1', () => {
    const h = [
      mkEntry({ correct: false }),
      mkEntry({ correct: true }),
      mkEntry({ correct: false }),
    ]
    expect(calcularRachaMaximaIncorrecta(h)).toBe(1)
  })
})

describe('determinarTipoEvolucion — modo legacy (sin currentResult)', () => {
  // Modo legacy: cuando el componente se renderiza sin pregunta activa
  // (revisión post-examen, etc.), comparamos penúltimo vs último del historial.
  test('history vacío → "primera_vez"', () => {
    const r = determinarTipoEvolucion([])
    expect(r.tipo).toBe('primera_vez')
  })
  test('1 previo blanco (sin current) → "blanco_reciente"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: false, blank: true })])
    expect(r.tipo).toBe('blanco_reciente')
    expect(r.color).toBe('gray')
  })
  test('1 previo acertado (sin current) → "consistente_correcto"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: true })])
    expect(r.tipo).toBe('consistente_correcto')
    expect(r.mensaje).toContain('última vez')
  })
  test('1 previo fallado (sin current) → "consistente_incorrecto"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: false })])
    expect(r.tipo).toBe('consistente_incorrecto')
    expect(r.mensaje).toContain('última vez')
  })
  test('blanco → acierto → "mejora_desde_blanco"', () => {
    const h = [mkEntry({ correct: false, blank: true }), mkEntry({ correct: true })]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('mejora_desde_blanco')
    expect(r.color).toBe('green')
  })
  test('fallo → acierto → "mejora"', () => {
    const h = [mkEntry({ correct: false }), mkEntry({ correct: true })]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('mejora')
  })
  test('acierto → blanco → "retroceso_a_blanco"', () => {
    const h = [mkEntry({ correct: true }), mkEntry({ correct: false, blank: true })]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('retroceso_a_blanco')
    expect(r.color).toBe('orange')
  })
  test('acierto → fallo → "retroceso"', () => {
    const h = [mkEntry({ correct: true }), mkEntry({ correct: false })]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('retroceso')
  })
  test('acierto consistente → "consistente_correcto"', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
    ]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('consistente_correcto')
  })
  test('blanco consistente → "consistente_blanco"', () => {
    const h = [
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: false, blank: true }),
    ]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('consistente_blanco')
    expect(r.color).toBe('gray')
  })
  test('fallo consistente → "consistente_incorrecto"', () => {
    const h = [
      mkEntry({ correct: false }),
      mkEntry({ correct: false }),
    ]
    const r = determinarTipoEvolucion(h)
    expect(r.tipo).toBe('consistente_incorrecto')
  })
})

describe('determinarTipoEvolucion — modo contractual (con currentResult)', () => {
  // CONTRATO: history contiene SOLO los intentos PREVIOS al actual.
  // El intento actual viene en currentResult, no está en history.
  // length=0 ⇒ primera vez. length=N ⇒ (N+1).ª vez.
  // (Bug histórico hasta 05/05/2026: length=1 se trataba como "primera vez".)

  test('history vacío + current acierto → "primera_vez" (sin comparación)', () => {
    const r = determinarTipoEvolucion([], { is_correct: true })
    expect(r.tipo).toBe('primera_vez')
  })
  test('1 previo acierto + current acierto → "consistente_correcto" (NO primera_vez)', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: true })], { is_correct: true })
    expect(r.tipo).toBe('consistente_correcto')
    expect(r.mensaje).toContain('2/2')
  })
  test('1 previo fallo + current acierto → "mejora"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: false })], { is_correct: true })
    expect(r.tipo).toBe('mejora')
  })
  test('1 previo acierto + current fallo → "retroceso"', () => {
    const r = determinarTipoEvolucion([mkEntry({ correct: true })], { is_correct: false })
    expect(r.tipo).toBe('retroceso')
  })
  test('1 previo blanco + current acierto → "mejora_desde_blanco"', () => {
    const r = determinarTipoEvolucion(
      [mkEntry({ correct: false, blank: true })],
      { is_correct: true },
    )
    expect(r.tipo).toBe('mejora_desde_blanco')
  })
  test('1 previo acierto + current blanco → "retroceso_a_blanco"', () => {
    const r = determinarTipoEvolucion(
      [mkEntry({ correct: true })],
      { is_correct: false, was_blank: true },
    )
    expect(r.tipo).toBe('retroceso_a_blanco')
  })
  test('3+ previos consistentes correctos + current acierto → "consistente_correcto" (4/4)', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
    ]
    const r = determinarTipoEvolucion(h, { is_correct: true })
    expect(r.tipo).toBe('consistente_correcto')
    expect(r.mensaje).toContain('4/4')
  })
  test('current ignora penúltimo: previo [fallo, acierto] + current fallo → retroceso (último previo=acierto)', () => {
    // Confirma que la lógica usa el último previo (no el penúltimo) para comparar con current
    const h = [mkEntry({ correct: false }), mkEntry({ correct: true })]
    const r = determinarTipoEvolucion(h, { is_correct: false })
    expect(r.tipo).toBe('retroceso')
  })
})

describe('calcularEvolucionCompleta — desglose correct/incorrect/blank', () => {
  test('historial vacío', () => {
    const e = calcularEvolucionCompleta([])
    expect(e.totalIntentos).toBe(0)
    expect(e.aciertosAbsolutos).toBe(0)
    expect(e.fallosAbsolutos).toBe(0)
    expect(e.blancosAbsolutos).toBe(0)
    expect(e.tasaAciertos).toBe(0)
  })

  test('2 correctos, 1 fallo, 1 blanco → tasa 50% (2/4)', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false }),
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
    ]
    const e = calcularEvolucionCompleta(h)
    expect(e.totalIntentos).toBe(4)
    expect(e.aciertosAbsolutos).toBe(2)
    expect(e.fallosAbsolutos).toBe(1)
    expect(e.blancosAbsolutos).toBe(1)
    expect(e.tasaAciertos).toBe(50)
  })

  test('invariante: aciertos + fallos + blancos === total', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false }),
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: false, blank: true }),
    ]
    const e = calcularEvolucionCompleta(h)
    expect(e.aciertosAbsolutos + e.fallosAbsolutos + e.blancosAbsolutos).toBe(e.totalIntentos)
  })

  test('estadísticas avanzadas: racha correcta ignora blancas', () => {
    const h = [
      mkEntry({ correct: true }),
      mkEntry({ correct: false, blank: true }),
      mkEntry({ correct: true }),
      mkEntry({ correct: true }),
    ]
    const e = calcularEvolucionCompleta(h)
    expect(e.estadisticasAvanzadas?.rachaMaximaCorrecta).toBe(3)
  })

  test('todas las preguntas en blanco → tasa 0%, racha correcta 0', () => {
    const h = Array.from({ length: 5 }, () => mkEntry({ correct: false, blank: true }))
    const e = calcularEvolucionCompleta(h)
    expect(e.aciertosAbsolutos).toBe(0)
    expect(e.fallosAbsolutos).toBe(0)
    expect(e.blancosAbsolutos).toBe(5)
    expect(e.tasaAciertos).toBe(0)
    expect(e.estadisticasAvanzadas?.rachaMaximaCorrecta).toBe(0)
    expect(e.estadisticasAvanzadas?.rachaMaximaIncorrecta).toBe(0)
  })

  test('CONTRATO + REGRESIÓN: 1 previo + current → no es primera_vez', () => {
    // Bug histórico (hasta 05/05/2026): cuando había 1 intento previo, el componente
    // mostraba "Primera vez que ves esta pregunta" — síntoma reportado por Nila en
    // feedback c294a029 (psicotécnicos) y feedbacks recurrentes en tests normales.
    // Este test documenta el contrato y bloquea la regresión.
    const h = [mkEntry({ correct: true })]
    const eWithCurrent = calcularEvolucionCompleta(h, { is_correct: true })
    expect(eWithCurrent.tipoEvolucion).not.toBe('primera_vez')
    expect(eWithCurrent.tipoEvolucion).toBe('consistente_correcto')

    // Modo legacy (sin currentResult): tampoco debe ser primera_vez si hay 1 previo
    const eLegacy = calcularEvolucionCompleta(h)
    expect(eLegacy.tipoEvolucion).not.toBe('primera_vez')
  })

  test('CONTRATO + REGRESIÓN (Nila 04/06): el intento actual se pliega en TODAS las cifras', () => {
    // Bug reportado por Nila: cabecera "12/12" pero "(11 intentos)" y "Último intento:
    // hace 3 meses" tras responder. Causa: las sub-stats usaban solo el historial
    // persistido (+ un agregado materializado desfasado), no el intento actual.
    // Contrato: con currentResult, totalIntentos = historial + 1 y el "último intento"
    // refleja AHORA (no un agregado viejo).
    const viejo = '2026-03-01T10:00:00Z'
    const h = Array.from({ length: 11 }, () => mkEntry({ correct: true, at: viejo }))
    const e = calcularEvolucionCompleta(h, { is_correct: true })
    expect(e.totalIntentos).toBe(12)                 // 11 previos + el actual (antes daba 11)
    expect(e.aciertosAbsolutos).toBe(12)
    expect(e.historialCompleto.length).toBe(12)
    expect(e.historialCompleto[11].current).toBe(true)
    // "Último intento" ≈ ahora, NO el de hace meses del historial
    const skewMs = Date.now() - (e.analisisTemporal?.ultimoIntento.getTime() ?? 0)
    expect(skewMs).toBeLessThan(60_000)
    expect(skewMs).toBeGreaterThanOrEqual(0)
  })

  test('regresión: data legacy sin was_blank (antes del 15/4/2026) se trata como is_correct normal', () => {
    // Entries antiguos no tienen was_blank field
    const legacyEntry: any = {
      id: 'x',
      user_answer: 'A',
      correct_answer: 'A',
      is_correct: true,
      // was_blank NO presente
      confidence_level: null,
      time_spent_seconds: 5,
      created_at: '2025-01-01T00:00:00Z',
      test_id: 't',
      question_order: 1,
      tests: null,
    }
    const e = calcularEvolucionCompleta([legacyEntry])
    expect(e.totalIntentos).toBe(1)
    expect(e.aciertosAbsolutos).toBe(1)
    expect(e.blancosAbsolutos).toBe(0)
  })
})

describe('calcularEvolucionCompleta — dedup por identidad estable (test_id) [bug MariSol, feedback 90aa6caa 24/07/2026]', () => {
  // El intento actual se persiste asíncrono con test_id = sesión del test en curso.
  // Si el guardado gana la carrera, ese intento YA está en `history`; sin la guardia
  // se duplicaba en la cronología ("Intento N" + "Ahora") e inflaba el conteo en +1.
  const withTest = (opts: Parameters<typeof mkEntry>[0], testId: string) => ({ ...mkEntry(opts), test_id: testId })

  test('intento actual YA persistido (test_id en history): NO duplica ni infla el conteo', () => {
    const history = [
      withTest({ correct: false }, 'test-A'),
      withTest({ correct: true }, 'test-B'), // el intento "actual", ya guardado
    ]
    const e = calcularEvolucionCompleta(history, { is_correct: true, test_id: 'test-B' })
    expect(e.deduped).toBe(true)
    expect(e.totalIntentos).toBe(2)             // NO 3
    expect(e.historialCompleto.length).toBe(2)  // sin fila duplicada
    expect(e.aciertosAbsolutos).toBe(1)         // 1 acierto real, no 2
    const currents = e.historialCompleto.filter(h => h.current)
    expect(currents.length).toBe(1)             // una sola fila marcada "actual"
    expect(currents[0].test_id).toBe('test-B')  // y es la persistida (fila real)
  })

  test('intento actual NO persistido aún (test_id nuevo): se añade "Ahora" (feedback instantáneo intacto)', () => {
    const history = [
      withTest({ correct: false }, 'test-A'),
      withTest({ correct: true }, 'test-B'),
    ]
    const e = calcularEvolucionCompleta(history, { is_correct: true, test_id: 'test-NEW' })
    expect(e.deduped).toBe(false)
    expect(e.totalIntentos).toBe(3)             // 2 previos + el actual
    expect(e.historialCompleto[2].current).toBe(true)
    expect(e.historialCompleto[2].test_id).toBe('test-NEW')
  })

  test('back-compat: currentResult SIN test_id → no deduplica (comportamiento anterior)', () => {
    const history = [withTest({ correct: true }, 'test-A')]
    const e = calcularEvolucionCompleta(history, { is_correct: true })
    expect(e.deduped).toBe(false)
    expect(e.totalIntentos).toBe(2)
  })

  test('SIMULACIÓN de la carrera de repaso-fallos: el mismo acierto NO sale dos veces', () => {
    // Reproduce el caso real de la captura: historial en vivo que ya incluye el
    // intento recién respondido (guardado asíncrono ganó la carrera) + currentResult
    // con su test_id. Antes del fix: totalIntentos=3 y dos filas "Correcto" seguidas.
    const history = [
      withTest({ correct: false, at: '2026-07-24T11:07:00Z' }, 'test-viejo'),
      withTest({ correct: true, at: '2026-07-24T11:38:00Z' }, 'test-ahora'),
    ]
    const e = calcularEvolucionCompleta(history, {
      is_correct: true, test_id: 'test-ahora', time_spent_seconds: 13, confidence_level: 'sure',
    })
    expect(e.deduped).toBe(true)
    expect(e.totalIntentos).toBe(2)
    expect(e.historialCompleto.filter(h => h.is_correct).length).toBe(1)
  })

  test('la dedup NO altera la cabecera/transición (fallo→acierto sigue siendo "mejora")', () => {
    const history = [
      withTest({ correct: false }, 'test-A'),
      withTest({ correct: true }, 'test-B'), // acierto actual ya persistido
    ]
    const e = calcularEvolucionCompleta(history, { is_correct: true, test_id: 'test-B' })
    expect(e.tipoEvolucion).toBe('mejora') // compara el fallo previo con el acierto actual
  })

  test('revisión post-examen (currentResult null): all === history, deduped false', () => {
    const history = [withTest({ correct: true }, 'test-A'), withTest({ correct: false }, 'test-B')]
    const e = calcularEvolucionCompleta(history)
    expect(e.deduped).toBe(false)
    expect(e.totalIntentos).toBe(2)
  })

  test('DATOS REALES MariSol (question 3eaf20e3): 9 intentos, sesión 0e29e810 repetida → dedup correcto, sin doble conteo', () => {
    // Volcado real de test_questions (RDS) de flor7687@gmail.com para la pregunta
    // reportada. OJO: la sesión 0e29e810 aparece DOS veces (respondió la misma
    // pregunta dos veces en la misma sesión) → (test_id, question_id) NO es único.
    const R = (correct: boolean, testId: string, at: string) => ({ ...mkEntry({ correct, at }), test_id: testId })
    const history = [
      R(false, '782fd7a4', '2026-05-02T06:35:17Z'),
      R(false, '0804d174', '2026-06-02T12:01:07Z'),
      R(false, '75e0c1b5', '2026-06-06T10:16:45Z'),
      R(false, '77a9c078', '2026-07-16T09:10:58Z'),
      R(true,  '0e29e810', '2026-07-16T09:13:25Z'), // misma sesión...
      R(false, '0e29e810', '2026-07-16T09:30:50Z'), // ...dos filas
      R(false, '665578b2', '2026-07-16T20:15:20Z'),
      R(false, '91822bf2', '2026-07-24T10:50:30Z'),
      R(true,  'e85d45ec', '2026-07-24T11:43:20Z'), // último = el intento actual
    ]
    const e = calcularEvolucionCompleta(history, { is_correct: true, test_id: 'e85d45ec', confidence_level: 'very_sure' })
    expect(e.deduped).toBe(true)
    expect(e.totalIntentos).toBe(9)                // NO 10
    expect(e.aciertosAbsolutos).toBe(2)            // 2 correctos reales (idx 4 y 8)
    // las DOS filas de la sesión repetida se conservan (no se colapsan)
    expect(e.historialCompleto.filter(h => h.test_id === '0e29e810').length).toBe(2)
    // una sola fila "actual", y es la ÚLTIMA (e85d45ec), no una 0e29e810 antigua
    const currents = e.historialCompleto.filter(h => h.current)
    expect(currents.length).toBe(1)
    expect(currents[0].test_id).toBe('e85d45ec')
  })

  test('test_id repetido NO en la última fila → NO deduplica (se ancla al intento más reciente)', () => {
    // Si el test_id del intento actual coincide con filas ANTIGUAS pero NO con la
    // última, es un intento genuinamente nuevo → se añade, no se colapsa contra las viejas.
    const R = (correct: boolean, testId: string, at: string) => ({ ...mkEntry({ correct, at }), test_id: testId })
    const history = [
      R(true, '0e29e810', '2026-07-16T09:13:25Z'),
      R(false, '0e29e810', '2026-07-16T09:30:50Z'),
      R(false, 'otra-mas-nueva', '2026-07-20T10:00:00Z'), // última ≠ 0e29e810
    ]
    const e = calcularEvolucionCompleta(history, { is_correct: true, test_id: '0e29e810' })
    expect(e.deduped).toBe(false)
    expect(e.totalIntentos).toBe(4) // 3 previos + el actual añadido
    expect(e.historialCompleto[3].current).toBe(true)
  })

  test('INVARIANTE (canary): totalIntentos === filas, a lo sumo UNA fila "actual", y ancla a la última fila', () => {
    // Barrido de combinaciones: N filas previas + un currentResult cuyo test_id coincide
    // con la ÚLTIMA fila (carrera ganada), con una fila antigua (NO debe deduplicar), o
    // es nuevo. Invariantes REALES (test_id NO es único → NO se exige unicidad):
    for (let n = 0; n <= 6; n++) {
      const history = Array.from({ length: n }, (_, i) =>
        withTest({ correct: i % 2 === 0 }, `test-${i}`))
      const ultima = n > 0 ? `test-${n - 1}` : undefined
      const antigua = n > 1 ? 'test-0' : undefined
      const candidatos = [ultima, antigua, 'test-nuevo', undefined]
      for (const tid of candidatos) {
        const e = calcularEvolucionCompleta(history, { is_correct: true, test_id: tid as string | undefined })
        // 1) sin conteo fantasma
        expect(e.totalIntentos).toBe(e.historialCompleto.length)
        // 2) a lo sumo una fila marcada como "actual"
        expect(e.historialCompleto.filter(h => h.current).length).toBeLessThanOrEqual(1)
        // 3) deduped ⇔ el test_id actual es el de la ÚLTIMA fila (el intento más reciente)
        const esUltima = !!tid && n > 0 && history[n - 1].test_id === tid
        expect(e.deduped).toBe(esUltima)
        // 4) si NO deduplica pero hay currentResult → se añadió exactamente 1 fila "Ahora"
        if (!e.deduped) expect(e.totalIntentos).toBe(n + 1)
      }
    }
  })
})
