// __tests__/api/article-sync/syncNormalization.test.ts
// Verifica que syncArticlesFromBoe normaliza article_number antes de insertar.
// Previene regresión: si alguien quita normalizeArticleNumber del insert, este test falla.

import { normalizeArticleNumber } from '@/lib/boe-extractor'

// Captura de inserts
const insertedValues: Array<Record<string, unknown>> = []
const lawData = { id: 'law-1', shortName: 'LOPJ', name: 'LO 6/1985', boeUrl: 'https://boe.es/lopj' }

jest.mock('@/db/client', () => ({
  getDb: () => ({
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue([lawData]),
          then: (resolve: (v: unknown[]) => void) => resolve([]),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn((vals: Record<string, unknown>) => {
        insertedValues.push(vals)
        return Promise.resolve()
      }),
    })),
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn().mockResolvedValue(undefined),
      })),
    })),
  }),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

import { syncArticlesFromBoe } from '@/lib/api/article-sync/queries'

describe('syncArticlesFromBoe - normalización de article_number', () => {
  beforeEach(() => {
    insertedValues.length = 0
    mockFetch.mockReset()
  })

  // Casos que el extractor BOE produce realmente
  const boeArticleCases = [
    { htmlNum: '55 bis', expected: '55 bis' },
    { htmlNum: '4 ter', expected: '4 ter' },
    { htmlNum: '108 quinquies', expected: '108 quinquies' },
    { htmlNum: '216 bis 2', expected: '216 bis 2' },
    { htmlNum: '42', expected: '42' },
  ]

  test.each(boeArticleCases)(
    'inserta "$expected" con article_number normalizado',
    async ({ htmlNum, expected }) => {
      const html = `
        <div class="bloque" id="a${htmlNum.replace(/\s/g, '')}">
          <h5 class="articulo">Artículo ${htmlNum}.</h5>
          <p>Contenido del artículo.</p>
        </div>
      `
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(html),
      })

      await syncArticlesFromBoe({ lawId: 'law-1' })

      expect(insertedValues).toHaveLength(1)
      expect(insertedValues[0].articleNumber).toBe(expected)
    }
  )

  test('el article_number insertado siempre es idéntico a normalizeArticleNumber(x)', async () => {
    // Un artículo bis con formato que el normalizador toca (separa "61bis" → "61 bis")
    const html = `
      <div class="bloque" id="a61bis">
        <h5 class="articulo">Artículo 61 bis.</h5>
        <p>Contenido.</p>
      </div>
    `
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(html),
    })

    await syncArticlesFromBoe({ lawId: 'law-1' })

    expect(insertedValues).toHaveLength(1)
    const inserted = insertedValues[0].articleNumber as string
    // El valor insertado debe ser exactamente lo que normalizeArticleNumber produce
    expect(inserted).toBe(normalizeArticleNumber(inserted))
  })

  test('normalizeArticleNumber es idempotente para todos los sufijos', () => {
    const cases = [
      '55 bis', '4 ter', '22 quater', '108 quinquies',
      '6 sexies', '7 septies', '8 octies', '9 nonies', '10 decies',
      '216 bis 2', '1', '100',
    ]
    for (const c of cases) {
      expect(normalizeArticleNumber(c)).toBe(c)
    }
  })

  test('normalizeArticleNumber corrige formatos pegados', () => {
    expect(normalizeArticleNumber('55bis')).toBe('55 bis')
    expect(normalizeArticleNumber('61bis')).toBe('61 bis')
    expect(normalizeArticleNumber('64bis')).toBe('64 bis')
    expect(normalizeArticleNumber('89bis')).toBe('89 bis')
    expect(normalizeArticleNumber('598bis')).toBe('598 bis')
    expect(normalizeArticleNumber('4BIS')).toBe('4 bis')
    expect(normalizeArticleNumber('22QUÁTER')).toBe('22 quater')
  })
})
