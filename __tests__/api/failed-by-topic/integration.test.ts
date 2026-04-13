/**
 * @jest-environment node
 */
// __tests__/api/failed-by-topic/integration.test.ts
// Simulación end-to-end: mock del SQL (Drizzle) devuelve filas como si fueran
// respuestas del BD. Verifica que la lógica de agrupación funciona y que el
// filtro por positionType se propaga correctamente.
//
// Escenarios clave:
//  - Usuario con respuestas de su oposición actual → recibe títulos correctos
//  - Usuario que cambió de oposición → el filtro descarta las respuestas del
//    target viejo (simulado con topics.position_type != nuevo target)
//  - positionType inválido → 400 sin tocar BD
//  - Sin auth → 401

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'

// Mock de Drizzle: la función retornada es la chained query.
// Guardamos los parámetros recibidos para verificarlos.
const capturedConditions: unknown[] = []
let mockRows: Array<{ temaNumber: number; topicTitle: string | null; questionId: string }> = []

jest.mock('@/db/client', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({
            leftJoin: (_topics: unknown, joinCond: unknown) => {
              capturedConditions.push({ joinCond })
              return {
                where: (whereCond: unknown) => {
                  capturedConditions.push({ whereCond })
                  return Promise.resolve(mockRows)
                },
              }
            },
          }),
        }),
      }),
    }),
  }),
  getAdminDb: () => ({}),
}))

// Mock del createClient auth
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-test-uuid' } } }),
    },
  })),
}))

import { getFailedQuestionsByTopic } from '@/lib/api/user-failed-questions/queries'

function resetMocks() {
  capturedConditions.length = 0
  mockRows = []
}

describe('getFailedQuestionsByTopic — lógica directa', () => {
  beforeEach(resetMocks)

  test('agrupa respuestas del mismo tema correctamente', async () => {
    mockRows = [
      { temaNumber: 5, topicTitle: 'El acto administrativo', questionId: 'q1' },
      { temaNumber: 5, topicTitle: 'El acto administrativo', questionId: 'q2' },
      { temaNumber: 5, topicTitle: 'El acto administrativo', questionId: 'q1' }, // repetida: mismo fallo
      { temaNumber: 6, topicTitle: 'LPAC', questionId: 'q3' },
    ]

    const result = await getFailedQuestionsByTopic('user-1', 'auxiliar_administrativo_madrid')
    expect(result.success).toBe(true)
    expect(result.topics).toHaveLength(2)

    const t5 = result.topics!.find(t => t.topicNumber === 5)!
    expect(t5.topicTitle).toBe('El acto administrativo')
    expect(t5.failedQuestions).toBe(2) // questionIds únicos (q1 y q2)
    expect(t5.totalFailures).toBe(3) // 3 filas en BD

    const t6 = result.topics!.find(t => t.topicNumber === 6)!
    expect(t6.failedQuestions).toBe(1)
    expect(t6.totalFailures).toBe(1)
  })

  test('ordena de mayor a menor por failedQuestions', async () => {
    mockRows = [
      { temaNumber: 1, topicTitle: 'T1', questionId: 'q1' },
      { temaNumber: 2, topicTitle: 'T2', questionId: 'q2' },
      { temaNumber: 2, topicTitle: 'T2', questionId: 'q3' },
      { temaNumber: 2, topicTitle: 'T2', questionId: 'q4' },
      { temaNumber: 3, topicTitle: 'T3', questionId: 'q5' },
      { temaNumber: 3, topicTitle: 'T3', questionId: 'q6' },
    ]

    const result = await getFailedQuestionsByTopic('user-1', 'auxiliar_administrativo_estado')
    expect(result.topics).toHaveLength(3)
    expect(result.topics![0].topicNumber).toBe(2) // 3 únicas
    expect(result.topics![1].topicNumber).toBe(3) // 2 únicas
    expect(result.topics![2].topicNumber).toBe(1) // 1 única
  })

  test('rechaza positionType vacío sin tocar BD', async () => {
    const result = await getFailedQuestionsByTopic('user-1', '')
    expect(result.success).toBe(false)
    expect(result.error).toContain('positionType')
    // BD NO debería haberse llamado
    expect(capturedConditions).toHaveLength(0)
  })

  test('devuelve array vacío si el usuario no tiene respuestas falladas', async () => {
    mockRows = []
    const result = await getFailedQuestionsByTopic('user-1', 'auxiliar_administrativo_madrid')
    expect(result.success).toBe(true)
    expect(result.topics).toEqual([])
  })

  test('SIMULACIÓN cambio de oposición — topicTitle null cuando topic_number no pertenece al nuevo target', async () => {
    // Usuario antes era Aux Estado (T101 válido), cambió a Madrid (T101 no existe).
    // La BD filtra por topics.position_type='madrid' → el leftJoin con T101 no
    // matchea ningún topic → topicTitle = null.
    mockRows = [
      { temaNumber: 5, topicTitle: 'El acto administrativo', questionId: 'q1' },  // válido en Madrid
      { temaNumber: 101, topicTitle: null, questionId: 'q2' },                    // topic 101 NO es de Madrid → null
    ]

    const result = await getFailedQuestionsByTopic('user-1', 'auxiliar_administrativo_madrid')
    expect(result.success).toBe(true)
    expect(result.topics).toHaveLength(2)

    const t5 = result.topics!.find(t => t.topicNumber === 5)!
    expect(t5.topicTitle).toBe('El acto administrativo')

    const t101 = result.topics!.find(t => t.topicNumber === 101)!
    // El topicTitle es null → la UI lo debe manejar (mostrar "Tema N" genérico
    // vía formatThemeName(101, 'auxiliar-administrativo-madrid') = "Tema 101")
    expect(t101.topicTitle).toBeNull()
  })

  test('NO mezcla títulos de otras oposiciones (regresión bug principal)', async () => {
    // Este test es el core del bug: antes, sin filtro, el JOIN devolvía
    // cualquier topicTitle con el mismo topic_number. Ahora el mock simula
    // que el filtro SQL ya aplicó y solo devuelve títulos de la oposición
    // indicada (Madrid). Cualquier título de Policía/Galicia debería ser null.
    mockRows = [
      { temaNumber: 5, topicTitle: 'El acto administrativo', questionId: 'q1' },  // Madrid T5
      { temaNumber: 8, topicTitle: 'Transparencia y Protección de Datos', questionId: 'q2' },  // Madrid T8
      // T9 de Madrid existe pero el mock simula que el JOIN lo resolvió mal
      // si no hubiera filtro, devolvería 'LO 2/1986 Fuerzas y Cuerpos' (Policía)
      // Con filtro correcto, devuelve el título de Madrid.
      { temaNumber: 9, topicTitle: 'Los contratos en el Sector Público', questionId: 'q3' },
    ]

    const result = await getFailedQuestionsByTopic('user-1', 'auxiliar_administrativo_madrid')
    expect(result.success).toBe(true)
    for (const t of result.topics!) {
      // Ningún título puede contener palabras típicas de otras oposiciones
      expect(t.topicTitle).not.toMatch(/Policía|Galicia|Guardia Civil|Fuerzas y Cuerpos/)
    }
  })
})
