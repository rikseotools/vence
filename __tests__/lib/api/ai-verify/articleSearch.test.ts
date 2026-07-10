/** @jest-environment node */
// __tests__/lib/api/ai-verify/articleSearch.test.ts
//
// Tests del CÓDIGO REAL de búsqueda de artículos de /api/ai/verify-answer
// (importa las funciones de producción, no re-implementa SQL → no es falso verde).
// Cazan las 2 regresiones que destapó la revisión adversarial de la migración:
//   F1 — la ley debe ser preferencia SUAVE (substring en name/short_name), no un
//        match EXACTO de short_name que fuerce el fallback si falla.
//   F2 — el fallback por keywords ANDea TODAS las palabras >3 chars (≤5), no solo 1.

// Mock de drizzle-orm con spies para inspeccionar las condiciones del WHERE (F2).
jest.mock('drizzle-orm', () => ({
  and: (...c: unknown[]) => ({ __and: c }),
  or: (...c: unknown[]) => ({ __or: c }),
  eq: (col: unknown, v: unknown) => ({ __eq: [col, v] }),
  ilike: (col: unknown, pat: unknown) => ({ __ilike: [col, pat] }),
}))

const mockGenEmb = jest.fn()
const mockSim = jest.fn()
let capturedWhere: unknown = null
let dbRows: unknown[] = [{ articleNumber: '1', content: 'c', lawShortName: 'L', lawName: 'Ley L' }]
const dbChain: Record<string, unknown> = {
  select: () => dbChain,
  from: () => dbChain,
  leftJoin: () => dbChain,
  where: (w: unknown) => { capturedWhere = w; return dbChain },
  limit: () => Promise.resolve(dbRows),
}

jest.mock('@/lib/chat/domains/search/EmbeddingService', () => ({ generateEmbedding: (...a: unknown[]) => mockGenEmb(...a) }))
jest.mock('@/lib/chat/domains/search/queries', () => ({ searchArticlesBySimilarity: (...a: unknown[]) => mockSim(...a) }))
jest.mock('@/db/client', () => ({ getDb: () => dbChain }))
jest.mock('@/db/schema', () => ({
  articles: { isActive: 'a.is_active', content: 'a.content', articleNumber: 'a.article_number', lawId: 'a.law_id' },
  laws: { id: 'l.id', shortName: 'l.short_name', name: 'l.name' },
}))

import { searchRelevantArticles, searchArticlesByKeywords } from '@/lib/api/ai-verify/articleSearch'

beforeEach(() => {
  jest.clearAllMocks()
  capturedWhere = null
  dbRows = [{ articleNumber: '1', content: 'c', lawShortName: 'L', lawName: 'Ley L' }]
  mockGenEmb.mockResolvedValue({ embedding: [0.1, 0.2] })
})

const match = (lawName: string, lawShortName: string, articleNumber: string) => ({
  lawName, lawShortName, articleNumber, content: `art ${articleNumber}`, similarity: 0.8,
})

describe('searchRelevantArticles — ley como preferencia SUAVE (F1)', () => {
  test('lawName por nombre COMPLETO (sin short_name) prioriza esos artículos, no fuerza fallback', async () => {
    mockSim.mockResolvedValue([
      match('Ley Otra Cosa', 'OTRA', '1'),
      match('Ley 4/1993 de ordenación de la función pública', '', '2'),
    ])
    // El cliente manda el name completo cuando no hay short_name.
    const res = await searchRelevantArticles('pregunta', 'Ley 4/1993 de ordenación de la función pública')
    expect(res).toHaveLength(1)
    expect(res[0].articleNumber).toBe('2') // ← el de la ley pedida, por substring en lawName
    expect(mockSim).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ mentionedLawNames: expect.anything() }))
  })

  test('si la ley NO matchea ningún hit → usa el top semántico igualmente (NO vacío, NO keyword)', async () => {
    mockSim.mockResolvedValue([match('Ley A', 'A', '1'), match('Ley B', 'B', '2')])
    const res = await searchRelevantArticles('pregunta', 'Ley Inexistente 99/9999')
    expect(res).toHaveLength(2) // top semántico, no [] ni fallback
    expect(res.map(r => r.articleNumber)).toEqual(['1', '2'])
    expect(mockGenEmb).toHaveBeenCalledTimes(1)
  })

  test('sin resultados semánticos → cae al fallback por keywords (getDb)', async () => {
    mockSim.mockResolvedValue([])
    dbRows = [{ articleNumber: '9', content: 'fallback', lawShortName: 'F', lawName: 'Ley F' }]
    const res = await searchRelevantArticles('plazo recurso alzada', 'Ley X')
    expect(res).toHaveLength(1)
    expect(res[0].articleNumber).toBe('9')
  })
})

describe('searchArticlesByKeywords — AND de TODAS las keywords (F2)', () => {
  test('ANDea un ILIKE(content) por cada palabra >3 chars (no solo la primera)', async () => {
    await searchArticlesByKeywords('el plazo de recurso alzada', null)
    const conds = (capturedWhere as { __and: Array<{ __ilike?: [unknown, unknown] }> }).__and
    const contentIlikes = conds.filter(c => c.__ilike && c.__ilike[0] === 'a.content')
    // palabras >3 chars: plazo, recurso, alzada → 3 ILIKE de content (el, de = ≤3 chars, fuera)
    expect(contentIlikes).toHaveLength(3)
    expect(contentIlikes.map(c => c.__ilike![1])).toEqual(['%plazo%', '%recurso%', '%alzada%'])
  })

  test('sin palabras >3 chars → devuelve [] sin tocar la BD', async () => {
    const res = await searchArticlesByKeywords('el de la un', null)
    expect(res).toEqual([])
    expect(capturedWhere).toBeNull()
  })

  test('con lawName añade el OR de name/short_name', async () => {
    await searchArticlesByKeywords('procedimiento administrativo', 'Ley 39/2015')
    const conds = (capturedWhere as { __and: Array<{ __or?: unknown }> }).__and
    expect(conds.some(c => c.__or)).toBe(true)
  })
})
