/**
 * Tests del repaso de fallos por LEY concreta (scope='law').
 *
 * Contexto del bug (María, 21/05/2026): el "Test de Repaso de Falladas"
 * lanzado desde /leyes/[law] iba al test normal (LawTestPageWrapper), que
 * ignora el filtro de falladas y devuelve la ley entera. Resultado: el test
 * incluía preguntas nunca falladas (incluso con 100% de acierto) y artículos
 * fuera de la selección del usuario.
 *
 * Fix: el modo repaso navega a /test/repaso-fallos-v2 con scope='law', que
 * calcula las falladas en el servidor (endpoint v2) sin pasar listas de IDs.
 *
 * Cobertura:
 *  - UNIT: el schema Zod acepta/valida el scope 'law' y los límites nuevos.
 *  - SIMULACIÓN: mapeos puros (orden, periodo, URL) y el algoritmo de
 *    re-orden con scope de getFailedQuestionsForUser.
 */

import {
  failedQuestionsScopeSchema,
  safeParseCreateFailedQuestionsTest,
} from '@/lib/api/tests'
import {
  mapModalOrderToEndpoint,
  mapFailedPeriodToDays,
  buildLawRepasoFallosUrl,
} from '@/lib/test-url/lawRepasoFallosUrl'

const VALID_UUID = '4ded0300-d1d1-45ab-b68f-9c0488a3195c'

// ============================================================
// UNIT — Schema Zod: scope 'law'
// ============================================================
describe('UNIT failedQuestionsScopeSchema — variante law', () => {
  it('acepta un scope law con lawShortName', () => {
    const r = failedQuestionsScopeSchema.safeParse({ type: 'law', lawShortName: 'Ley 9/2017' })
    expect(r.success).toBe(true)
  })

  it('rechaza scope law sin lawShortName', () => {
    const r = failedQuestionsScopeSchema.safeParse({ type: 'law' })
    expect(r.success).toBe(false)
  })

  it('rechaza scope law con lawShortName vacío', () => {
    const r = failedQuestionsScopeSchema.safeParse({ type: 'law', lawShortName: '' })
    expect(r.success).toBe(false)
  })

  it('el scope law NO exige positionType (lo acota getAllowedLawIds aguas arriba)', () => {
    const r = failedQuestionsScopeSchema.safeParse({
      type: 'law',
      lawShortName: 'Ley 9/2017',
      // sin positionType — debe seguir siendo válido
    })
    expect(r.success).toBe(true)
  })

  it('no rompe los scopes preexistentes (block / topic / position)', () => {
    expect(failedQuestionsScopeSchema.safeParse({
      type: 'block', bloqueNumber: 2, positionType: 'auxiliar_administrativo_estado',
    }).success).toBe(true)
    expect(failedQuestionsScopeSchema.safeParse({
      type: 'topic', topicNumbers: [1, 2], positionType: 'auxiliar_administrativo_estado',
    }).success).toBe(true)
    expect(failedQuestionsScopeSchema.safeParse({
      type: 'position', positionType: 'auxiliar_administrativo_estado',
    }).success).toBe(true)
  })

  it('rechaza un type de scope desconocido', () => {
    expect(failedQuestionsScopeSchema.safeParse({ type: 'galaxia', lawShortName: 'X' }).success).toBe(false)
  })
})

// ============================================================
// UNIT — Schema de request completo: límites y scope law
// ============================================================
describe('UNIT createFailedQuestionsTestRequestSchema — límites y scope', () => {
  it('acepta una petición completa con scope law', () => {
    const r = safeParseCreateFailedQuestionsTest({
      userId: VALID_UUID,
      numQuestions: 49,
      orderBy: 'most_failed',
      days: 36500,
      scope: { type: 'law', lawShortName: 'Ley 9/2017' },
    })
    expect(r.success).toBe(true)
  })

  it('acepta numQuestions hasta 300 (heavy users)', () => {
    expect(safeParseCreateFailedQuestionsTest({ userId: VALID_UUID, numQuestions: 300 }).success).toBe(true)
  })

  it('rechaza numQuestions por encima de 300', () => {
    expect(safeParseCreateFailedQuestionsTest({ userId: VALID_UUID, numQuestions: 301 }).success).toBe(false)
  })

  it('acepta days hasta 36500 (≈100 años → "todas las falladas")', () => {
    expect(safeParseCreateFailedQuestionsTest({ userId: VALID_UUID, days: 36500 }).success).toBe(true)
  })

  it('rechaza days por encima de 36500', () => {
    expect(safeParseCreateFailedQuestionsTest({ userId: VALID_UUID, days: 36501 }).success).toBe(false)
  })

  it('aplica los defaults (orderBy=recent, numQuestions=10)', () => {
    const r = safeParseCreateFailedQuestionsTest({ userId: VALID_UUID })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.orderBy).toBe('recent')
      expect(r.data.numQuestions).toBe(10)
    }
  })

  it('rechaza userId que no es uuid', () => {
    expect(safeParseCreateFailedQuestionsTest({ userId: 'no-soy-uuid' }).success).toBe(false)
  })
})

// ============================================================
// SIMULACIÓN — Mapeo de orden modal → endpoint v2
// ============================================================
describe('SIM mapModalOrderToEndpoint', () => {
  it('most_failed se conserva', () => {
    expect(mapModalOrderToEndpoint('most_failed')).toBe('most_failed')
  })
  it('recent_failed → recent', () => {
    expect(mapModalOrderToEndpoint('recent_failed')).toBe('recent')
  })
  it('oldest_failed → oldest', () => {
    expect(mapModalOrderToEndpoint('oldest_failed')).toBe('oldest')
  })
  it('random se conserva', () => {
    expect(mapModalOrderToEndpoint('random')).toBe('random')
  })
  it('undefined cae al default recent', () => {
    expect(mapModalOrderToEndpoint(undefined)).toBe('recent')
  })
  it('un valor desconocido cae al default recent', () => {
    expect(mapModalOrderToEndpoint('xyz')).toBe('recent')
  })
  it('todos los valores mapeados son órdenes válidos del endpoint v2', () => {
    // failedQuestionsOrderSchema = recent | most_failed | worst_accuracy | oldest | random
    const valid = new Set(['recent', 'most_failed', 'worst_accuracy', 'oldest', 'random'])
    for (const modalOrder of ['most_failed', 'recent_failed', 'oldest_failed', 'random', undefined, 'basura']) {
      expect(valid.has(mapModalOrderToEndpoint(modalOrder))).toBe(true)
    }
  })
})

// ============================================================
// SIMULACIÓN — Mapeo de periodo → días
// ============================================================
describe('SIM mapFailedPeriodToDays', () => {
  it('all → 36500 (todas)', () => {
    expect(mapFailedPeriodToDays('all')).toBe(36500)
  })
  it('7d → 7', () => {
    expect(mapFailedPeriodToDays('7d')).toBe(7)
  })
  it('30d → 30', () => {
    expect(mapFailedPeriodToDays('30d')).toBe(30)
  })
  it('undefined cae al default 36500', () => {
    expect(mapFailedPeriodToDays(undefined)).toBe(36500)
  })
  it('un valor desconocido cae al default 36500', () => {
    expect(mapFailedPeriodToDays('xyz')).toBe(36500)
  })
  it('los días mapeados no superan el límite del schema (36500)', () => {
    for (const p of ['all', '7d', '30d', undefined, 'basura']) {
      expect(mapFailedPeriodToDays(p)).toBeLessThanOrEqual(36500)
      expect(mapFailedPeriodToDays(p)).toBeGreaterThanOrEqual(1)
    }
  })
})

// ============================================================
// SIMULACIÓN — Construcción de la URL del repaso por ley
// ============================================================
describe('SIM buildLawRepasoFallosUrl', () => {
  it('apunta a /test/repaso-fallos-v2 (NO al test normal de la ley)', () => {
    const url = buildLawRepasoFallosUrl({ lawShortName: 'Ley 9/2017', numQuestions: 10 })
    expect(url.startsWith('/test/repaso-fallos-v2?')).toBe(true)
    expect(url).not.toContain('/avanzado')
  })

  it('incluye law, order, n y days', () => {
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 9/2017',
      numQuestions: 49,
      failedQuestionsOrder: 'most_failed',
      failedPeriod: 'all',
    })
    const qs = new URLSearchParams(url.split('?')[1])
    expect(qs.get('law')).toBe('Ley 9/2017')
    expect(qs.get('order')).toBe('most_failed')
    expect(qs.get('n')).toBe('49')
    expect(qs.get('days')).toBe('36500')
  })

  it('NO incluye listas de IDs (failed_ids) — el servidor recalcula', () => {
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 9/2017', numQuestions: 49, failedQuestionsOrder: 'most_failed',
    })
    expect(url).not.toContain('failed_ids')
    expect(url).not.toContain('failed_id=')
  })

  it('codifica correctamente leyes con barra y espacios', () => {
    const url = buildLawRepasoFallosUrl({ lawShortName: 'Ley 9/2017', numQuestions: 10 })
    // la barra y el espacio deben ir escapados en la query string...
    expect(url).toContain('law=Ley')
    expect(url).not.toContain('law=Ley 9/2017') // sin escapar sería inválido
    // ...y al decodificar debe recuperarse el short_name exacto
    const qs = new URLSearchParams(url.split('?')[1])
    expect(qs.get('law')).toBe('Ley 9/2017')
  })

  it('traduce recent_failed/oldest_failed/30d en la URL final', () => {
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 39/2015',
      numQuestions: 25,
      failedQuestionsOrder: 'oldest_failed',
      failedPeriod: '30d',
    })
    const qs = new URLSearchParams(url.split('?')[1])
    expect(qs.get('order')).toBe('oldest')
    expect(qs.get('days')).toBe('30')
  })

  it('una URL "todas las falladas" no excede límites razonables de longitud', () => {
    // Con sessionStorage/IDs la URL crecía sin techo (heavy users → HTTP 431).
    // Con scope server-side la longitud es constante, no depende del nº de falladas.
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 9/2017', numQuestions: 300, failedQuestionsOrder: 'most_failed', failedPeriod: 'all',
    })
    expect(url.length).toBeLessThan(120)
  })
})

// ============================================================
// SIMULACIÓN — Algoritmo de re-orden con scope
// (getFailedQuestionsForUser: el SELECT con `id IN (...)` no garantiza
//  orden, así que se re-ordena según la lista ya ordenada por orderBy).
// ============================================================
describe('SIM re-orden de resultados con scope', () => {
  // Réplica fiel del algoritmo en lib/api/tests/queries.ts (rama hasScope).
  function reorderWithScope<T extends { id: string }>(
    questionsFromDb: T[],
    sortedQuestionIds: { questionId: string }[],
    numQuestions: number,
  ): T[] {
    const idOrder = new Map(sortedQuestionIds.map((q, i) => [q.questionId, i]))
    return [...questionsFromDb]
      .sort((a, b) => (idOrder.get(a.id) ?? Infinity) - (idOrder.get(b.id) ?? Infinity))
      .slice(0, numQuestions)
  }

  it('respeta el orden de orderBy aunque la BD devuelva otro orden', () => {
    const sorted = [{ questionId: 'c' }, { questionId: 'a' }, { questionId: 'b' }]
    const fromDb = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] // orden arbitrario del IN
    const result = reorderWithScope(fromDb, sorted, 10)
    expect(result.map(q => q.id)).toEqual(['c', 'a', 'b'])
  })

  it('REGRESIÓN: re-ordena también cuando hay ≤ numQuestions resultados', () => {
    // El bug previo: solo re-ordenaba si length > numQuestions. Con 3 falladas
    // y n=10 NO re-ordenaba → el orden "más falladas primero" se perdía.
    const sorted = [{ questionId: 'c' }, { questionId: 'a' }, { questionId: 'b' }]
    const fromDb = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const result = reorderWithScope(fromDb, sorted, 10) // 3 resultados, n=10
    expect(result.map(q => q.id)).toEqual(['c', 'a', 'b'])
  })

  it('limita a numQuestions cuando hay más falladas que las pedidas', () => {
    const sorted = [
      { questionId: 'q1' }, { questionId: 'q2' }, { questionId: 'q3' }, { questionId: 'q4' },
    ]
    const fromDb = [{ id: 'q4' }, { id: 'q1' }, { id: 'q3' }, { id: 'q2' }]
    const result = reorderWithScope(fromDb, sorted, 2)
    expect(result.map(q => q.id)).toEqual(['q1', 'q2'])
  })

  it('una pregunta no presente en el orden va al final (Infinity), no rompe', () => {
    const sorted = [{ questionId: 'a' }, { questionId: 'b' }]
    const fromDb = [{ id: 'huerfana' }, { id: 'b' }, { id: 'a' }]
    const result = reorderWithScope(fromDb, sorted, 10)
    expect(result.map(q => q.id)).toEqual(['a', 'b', 'huerfana'])
  })
})
