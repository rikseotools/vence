/**
 * Integración: pipeline content_data → cliente
 *
 * Garantiza que las preguntas técnicas (Word/Excel/Windows) con icono
 * guardado en content_data.image_base64 propagan ese campo desde la
 * capa de query (Drizzle row) hasta el shape que llega a TestLayout.
 *
 * Si este test se rompe, las preguntas técnicas con icono dejarán de
 * verse en el cliente — flujo originario de la dispute ed59b2d2 (Nila,
 * 08/05/2026).
 */
import { transformQuestion } from '@/lib/api/filtered-questions/queries'

const TINY_PNG_B64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    questionText: '¿En qué grupo está el icono?',
    optionA: 'A',
    optionB: 'B',
    optionC: 'C',
    optionD: 'D',
    optionE: null,
    explanation: 'Explicación',
    difficulty: 'medium',
    questionType: 'single',
    tags: null,
    isActive: true,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    primaryArticleId: 'art-1',
    isOfficialExam: false,
    examSource: null,
    examDate: null,
    examEntity: null,
    examPosition: null,
    officialDifficultyLevel: null,
    imageUrl: null,
    contentData: null,
    correctOption: 1,
    globalDifficultyCategory: null,
    articleId: 'art-1',
    articleNumber: '4',
    articleTitle: 'Combinación de correspondencia en Word 365',
    articleContent: 'Contenido del artículo',
    lawId: 'law-1',
    lawName: 'Procesadores de texto',
    lawShortName: 'Procesadores de texto',
    sourceTopic: null,
    ...overrides,
  } as Parameters<typeof transformQuestion>[0]
}

describe('Pipeline legislativa: content_data.image_base64 → cliente', () => {
  test('propaga image_base64 intacto a través de transformQuestion', () => {
    const row = makeRow({ contentData: { image_base64: TINY_PNG_B64 } })
    const result = transformQuestion(row, 0)
    expect(result.content_data).not.toBeNull()
    expect(result.content_data).toEqual({ image_base64: TINY_PNG_B64 })
  })

  test('propaga image_url cuando está presente', () => {
    const row = makeRow({ imageUrl: 'https://example.com/icon.png' })
    const result = transformQuestion(row, 0)
    expect(result.image_url).toBe('https://example.com/icon.png')
  })

  test('regresión: content_data null y image_url null → ambos null en salida', () => {
    const row = makeRow()
    const result = transformQuestion(row, 0)
    expect(result.content_data).toBeNull()
    expect(result.image_url).toBeNull()
  })

  test('mantiene image_base64 junto a otros campos del content_data', () => {
    const row = makeRow({
      contentData: {
        image_base64: TINY_PNG_B64,
        instructions: ['Paso 1', 'Paso 2'],
      },
    })
    const result = transformQuestion(row, 0)
    expect(result.content_data).toMatchObject({
      image_base64: TINY_PNG_B64,
      instructions: ['Paso 1', 'Paso 2'],
    })
  })

  test('caso real Nila (dispute ed59b2d2): pregunta técnica con icono', () => {
    const row = makeRow({
      id: '07a87599-ffe5-4462-920e-dd4ef9b0ef3c',
      questionText:
        '¿En que panel del menú de correspondencia podemos encontrar el siguiente icono?',
      optionA: 'Escribir e insertar campos',
      optionB: 'Vista previa de resultados',
      optionC: 'Iniciar combinación de correspondencia',
      optionD: 'Finalizar y combinar',
      correctOption: 1,
      contentData: { image_base64: TINY_PNG_B64 },
      lawShortName: 'Procesadores de texto',
    })
    const result = transformQuestion(row, 0)
    expect(result.content_data).toEqual({ image_base64: TINY_PNG_B64 })
    expect(result.options).toEqual([
      'Escribir e insertar campos',
      'Vista previa de resultados',
      'Iniciar combinación de correspondencia',
      'Finalizar y combinar',
    ])
    expect(result.correct_option).toBe(1)
  })
})
