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
  serializeSelectedArticles,
} from '@/lib/test-url/lawRepasoFallosUrl'
import { parseSelectedArticlesScope } from '@/lib/navigation/backToArticleLink'

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
    const url = buildLawRepasoFallosUrl({ lawShortName: 'Ley 9/2017', numQuestions: 10, selectedArticles: [] })
    expect(url.startsWith('/test/repaso-fallos-v2?')).toBe(true)
    expect(url).not.toContain('/avanzado')
  })

  it('incluye law, order, n y days', () => {
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 9/2017',
      numQuestions: 49,
      failedQuestionsOrder: 'most_failed',
      failedPeriod: 'all',
      selectedArticles: [],
    })
    const qs = new URLSearchParams(url.split('?')[1])
    expect(qs.get('law')).toBe('Ley 9/2017')
    expect(qs.get('order')).toBe('most_failed')
    expect(qs.get('n')).toBe('49')
    expect(qs.get('days')).toBe('36500')
  })

  it('NO incluye listas de IDs (failed_ids) — el servidor recalcula', () => {
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 9/2017', numQuestions: 49, failedQuestionsOrder: 'most_failed', selectedArticles: [],
    })
    expect(url).not.toContain('failed_ids')
    expect(url).not.toContain('failed_id=')
  })

  it('codifica correctamente leyes con barra y espacios', () => {
    const url = buildLawRepasoFallosUrl({ lawShortName: 'Ley 9/2017', numQuestions: 10, selectedArticles: [] })
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
      selectedArticles: [],
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
      selectedArticles: [],
    })
    expect(url.length).toBeLessThan(120)
  })
})

// ============================================================
// T-603 — La SELECCIÓN DE ARTÍCULOS tiene que sobrevivir al salto
//
// Bug: al marcar «solo preguntas falladas», el salto a /test/repaso-fallos-v2
// tiraba `selectedArticlesByLaw` en silencio y el test servía la ley entera,
// con las casillas del usuario todavía marcadas en pantalla. Medido en la
// cuenta de María el 05/08: hasta 6 de 20 preguntas fuera de su selección por
// este camino, y 0 de 25 por /avanzado (los dos caminos discrepaban).
// ============================================================
describe('T-603 serializeSelectedArticles', () => {
  it('devuelve cadena vacía sin artículos (→ el llamador omite el parámetro)', () => {
    expect(serializeSelectedArticles([])).toBe('')
    expect(serializeSelectedArticles(null)).toBe('')
    expect(serializeSelectedArticles(undefined)).toBe('')
  })

  it('acepta números y strings mezclados (el configurador manda ambos)', () => {
    expect(serializeSelectedArticles([1, '2', 3])).toBe('1,2,3')
  })

  it('deduplica conservando el orden y descarta vacíos', () => {
    expect(serializeSelectedArticles(['5', '5', '', '  ', '6'])).toBe('5,6')
  })

  it('codifica los identificadores con espacio, que si no rompen la query string', () => {
    // '55 ter' sin codificar cortaría la URL por el espacio.
    expect(serializeSelectedArticles(['55 ter'])).toBe('55%20ter')
  })
})

describe('T-603 buildLawRepasoFallosUrl — la selección viaja', () => {
  it('incluye selected_articles cuando el usuario acotó', () => {
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 9/2017', numQuestions: 20, selectedArticles: ['1', '2', '3'],
    })
    const qs = new URLSearchParams(url.split('?')[1])
    expect(qs.get('selected_articles')).toBe('1,2,3')
  })

  it('NO incluye el parámetro cuando no acotó (ley entera, como siempre)', () => {
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 9/2017', numQuestions: 20, selectedArticles: [],
    })
    expect(url).not.toContain('selected_articles')
  })

  it('usa el MISMO nombre de parámetro que /leyes/[law]/avanzado', () => {
    // Si divergiera, cada camino tendría su vocabulario y el parser canónico
    // dejaría de valer para los dos: es como nacen los silos.
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 9/2017', numQuestions: 20, selectedArticles: ['7'],
    })
    expect(url).toContain('selected_articles=')
  })

  it('REGRESIÓN T-603: ida y vuelta con el parser de producción, sin perder nada', () => {
    // Este es el test que habría cazado el bug: construir la URL y leerla con
    // el MISMO parser que usa la página de destino.
    const seleccion = ['1', '55 ter', 'DA1', '32 bis', '112']
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 9/2017', numQuestions: 20, selectedArticles: seleccion,
    })
    const qs = new URLSearchParams(url.split('?')[1])
    expect(parseSelectedArticlesScope(qs.get('selected_articles'))).toEqual(seleccion)
  })

  it('los identificadores NO numéricos sobreviven enteros (nada de parseInt)', () => {
    // 'DA1'→NaN y '55 ter'→55 son la forma de sub-servir en silencio.
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 39/2015', numQuestions: 10, selectedArticles: ['DA1', '55 ter'],
    })
    const qs = new URLSearchParams(url.split('?')[1])
    const leidos = parseSelectedArticlesScope(qs.get('selected_articles'))
    expect(leidos).toContain('DA1')
    expect(leidos).toContain('55 ter')
    expect(leidos.some(a => a === '55')).toBe(false)
  })

  it('la selección real de María (95 artículos) cabe de sobra en la URL', () => {
    // La razón por la que en su día no se pasaron listas era el tamaño (HTTP 431
    // con listas de IDs de PREGUNTAS). Los ARTÍCULOS son otro orden de magnitud,
    // y /avanzado ya los pasa así en producción desde hace meses.
    const noventaYCinco = Array.from({ length: 95 }, (_, i) => String(i + 1))
    const url = buildLawRepasoFallosUrl({
      lawShortName: 'Ley 9/2017', numQuestions: 20, selectedArticles: noventaYCinco,
    })
    expect(url.length).toBeLessThan(600)
    const qs = new URLSearchParams(url.split('?')[1])
    expect(parseSelectedArticlesScope(qs.get('selected_articles'))).toHaveLength(95)
  })
})

describe('T-603 failedQuestionsScopeSchema — articleNumbers', () => {
  it('acepta scope law con articleNumbers', () => {
    const r = failedQuestionsScopeSchema.safeParse({
      type: 'law', lawShortName: 'Ley 9/2017', articleNumbers: ['1', 'DA1', '55 ter'],
    })
    expect(r.success).toBe(true)
  })

  it('sigue aceptando scope law SIN articleNumbers (retrocompatible)', () => {
    expect(failedQuestionsScopeSchema.safeParse({
      type: 'law', lawShortName: 'Ley 9/2017',
    }).success).toBe(true)
  })

  it('rechaza articleNumbers vacío: "acoté a nada" no es una petición válida', () => {
    // Si colara, el filtro no se aplicaría y volveríamos a servir la ley entera
    // creyendo que hemos acotado — justo el fallo que se está arreglando.
    expect(failedQuestionsScopeSchema.safeParse({
      type: 'law', lawShortName: 'Ley 9/2017', articleNumbers: [],
    }).success).toBe(false)
  })

  it('rechaza articleNumbers numéricos: la columna es TEXTO', () => {
    expect(failedQuestionsScopeSchema.safeParse({
      type: 'law', lawShortName: 'Ley 9/2017', articleNumbers: [1, 2],
    }).success).toBe(false)
  })

  it('la petición completa admite el scope con artículos', () => {
    expect(safeParseCreateFailedQuestionsTest({
      userId: VALID_UUID,
      numQuestions: 20,
      scope: { type: 'law', lawShortName: 'Ley 9/2017', articleNumbers: ['138', '143'] },
    }).success).toBe(true)
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
