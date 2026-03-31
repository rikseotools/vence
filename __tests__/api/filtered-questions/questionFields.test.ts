/**
 * Tests para verificar que questionColumns, QuestionRow y transformQuestion
 * incluyen TODOS los campos necesarios del schema de questions.
 *
 * Estos tests previenen bugs como el de image_url faltante en la API
 * filtered-questions, que causó que preguntas con imágenes no las mostraran.
 */

// Campos que el schema de DB tiene en la tabla questions
// y que DEBEN estar en questionColumns para que lleguen al frontend
const REQUIRED_QUESTION_DB_FIELDS = [
  'id',
  'questionText',
  'optionA',
  'optionB',
  'optionC',
  'optionD',
  'explanation',
  'difficulty',
  'questionType',
  'tags',
  'isActive',
  'createdAt',
  'updatedAt',
  'primaryArticleId',
  'isOfficialExam',
  'examSource',
  'examDate',
  'examEntity',
  'examPosition',
  'officialDifficultyLevel',
  'imageUrl',
  'contentData',
] as const

const REQUIRED_ARTICLE_DB_FIELDS = [
  'articleId',
  'articleNumber',
  'articleTitle',
  'articleContent',
  'lawId',
  'lawName',
  'lawShortName',
] as const

// Campos que FilteredQuestion (schema Zod) debe tener para que el frontend funcione
const REQUIRED_OUTPUT_FIELDS = [
  'id',
  'question',
  'options',
  'explanation',
  'primary_article_id',
  'tema',
  'image_url',
  'content_data',
  'article',
  'metadata',
] as const

// Campos del artículo en la respuesta
const REQUIRED_ARTICLE_OUTPUT_FIELDS = [
  'id',
  'number',
  'title',
  'full_text',
  'law_name',
  'law_short_name',
  'display_number',
] as const

// Campos de metadata
const REQUIRED_METADATA_FIELDS = [
  'id',
  'difficulty',
  'question_type',
  'tags',
  'is_active',
  'created_at',
  'updated_at',
  'is_official_exam',
  'exam_source',
  'exam_date',
  'exam_entity',
  'official_difficulty_level',
] as const

// Mock de una QuestionRow completa (simula lo que devuelve el select de Drizzle)
function createMockQuestionRow() {
  return {
    id: '4ba08498-7f03-4f23-933c-14d4b9f66731',
    questionText: 'Pregunta sobre gráfico de Word',
    optionA: 'Gráfico de área 3D.',
    optionB: 'Gráfico de banda 3D.',
    optionC: 'Gráfico de superficie 3D.',
    optionD: 'Gráfico de barra 3D.',
    explanation: 'La respuesta correcta es A.',
    difficulty: 'medium',
    questionType: 'single',
    tags: ['word', 'gráficos'],
    isActive: true,
    createdAt: '2026-03-31T10:00:00+00:00',
    updatedAt: '2026-03-31T10:00:00+00:00',
    primaryArticleId: '2dbef80e-7afd-459b-a180-a2c769604ffc',
    isOfficialExam: true,
    examSource: 'CyL 2024',
    examDate: '2024-06-15',
    examEntity: 'Junta de Castilla y León',
    examPosition: 'auxiliar_administrativo_cyl',
    officialDifficultyLevel: 'medium',
    imageUrl: 'https://example.supabase.co/storage/v1/object/public/question-images/test.png',
    contentData: {},
    articleId: '2dbef80e-7afd-459b-a180-a2c769604ffc',
    articleNumber: '6',
    articleTitle: 'Procesadores de texto',
    articleContent: 'Contenido del artículo...',
    lawId: 'abc-123',
    lawName: 'Procesadores de texto',
    lawShortName: 'Procesadores de texto',
    sourceTopic: 108,
  }
}

describe('questionColumns - campos del select de Drizzle', () => {
  // Leemos el archivo fuente para verificar los campos
  const fs = require('fs')
  const source = fs.readFileSync('lib/api/filtered-questions/queries.ts', 'utf-8')

  // Extraer las keys de questionColumns del código fuente
  const questionColumnsMatch = source.match(/const questionColumns = \{([^}]+)\}/s)
  const questionColumnsBlock = questionColumnsMatch?.[1] || ''

  const articleColumnsMatch = source.match(/const articleColumns = \{([^}]+)\}/s)
  const articleColumnsBlock = articleColumnsMatch?.[1] || ''

  it('questionColumns incluye TODOS los campos requeridos de questions', () => {
    for (const field of REQUIRED_QUESTION_DB_FIELDS) {
      expect(questionColumnsBlock).toContain(`${field}:`)
    }
  })

  it('articleColumns incluye TODOS los campos requeridos de articles/laws', () => {
    for (const field of REQUIRED_ARTICLE_DB_FIELDS) {
      expect(articleColumnsBlock).toContain(`${field}:`)
    }
  })

  it('questionColumns incluye imageUrl (bug regression: preguntas con imagen no la mostraban)', () => {
    expect(questionColumnsBlock).toContain('imageUrl:')
  })

  it('questionColumns incluye contentData (necesario para tablas, instrucciones, etc.)', () => {
    expect(questionColumnsBlock).toContain('contentData:')
  })
})

describe('QuestionRow type - campos del tipo compartido', () => {
  const fs = require('fs')
  const source = fs.readFileSync('lib/api/filtered-questions/queries.ts', 'utf-8')

  const typeMatch = source.match(/type QuestionRow = \{([^}]+)\}/s)
  const typeBlock = typeMatch?.[1] || ''

  it('QuestionRow incluye imageUrl', () => {
    expect(typeBlock).toContain('imageUrl:')
  })

  it('QuestionRow incluye contentData', () => {
    expect(typeBlock).toContain('contentData:')
  })

  it('QuestionRow incluye sourceTopic', () => {
    expect(typeBlock).toContain('sourceTopic:')
  })

  it('QuestionRow tiene TODOS los campos de questionColumns', () => {
    for (const field of REQUIRED_QUESTION_DB_FIELDS) {
      expect(typeBlock).toContain(`${field}:`)
    }
  })
})

describe('transformQuestion - transforma correctamente al formato FilteredQuestion', () => {
  // Importar la función no es posible directamente (no exportada),
  // así que verificamos el output via source code analysis
  const fs = require('fs')
  const source = fs.readFileSync('lib/api/filtered-questions/queries.ts', 'utf-8')

  const transformMatch = source.match(/function transformQuestion\(q: QuestionRow, index: number\): FilteredQuestion \{([^]*?)\n\}/s)
  const transformBlock = transformMatch?.[1] || ''

  it('transformQuestion incluye image_url en el output', () => {
    expect(transformBlock).toContain('image_url:')
  })

  it('transformQuestion incluye content_data en el output', () => {
    expect(transformBlock).toContain('content_data:')
  })

  it('transformQuestion incluye TODOS los campos requeridos del output', () => {
    for (const field of REQUIRED_OUTPUT_FIELDS) {
      expect(transformBlock).toContain(`${field}:`)
    }
  })

  it('transformQuestion incluye TODOS los campos de article', () => {
    for (const field of REQUIRED_ARTICLE_OUTPUT_FIELDS) {
      expect(transformBlock).toContain(`${field}:`)
    }
  })

  it('transformQuestion incluye TODOS los campos de metadata', () => {
    for (const field of REQUIRED_METADATA_FIELDS) {
      expect(transformBlock).toContain(`${field}:`)
    }
  })
})

describe('filteredQuestionSchema - schema Zod incluye campos visuales', () => {
  const fs = require('fs')
  const source = fs.readFileSync('lib/api/filtered-questions/schemas.ts', 'utf-8')

  const schemaMatch = source.match(/export const filteredQuestionSchema = z\.object\(\{([^}]+)\}\)/s)
  const schemaBlock = schemaMatch?.[1] || ''

  it('schema incluye image_url', () => {
    expect(schemaBlock).toContain('image_url:')
  })

  it('schema incluye content_data', () => {
    expect(schemaBlock).toContain('content_data:')
  })
})

describe('No hay selects duplicados fuera de questionColumns', () => {
  const fs = require('fs')
  const source = fs.readFileSync('lib/api/filtered-questions/queries.ts', 'utf-8')

  it('no hay selects inline con questionText (todo debe usar questionColumns)', () => {
    // Buscar selects que tengan questionText: questions.questionText
    // pero NO dentro de la definición de questionColumns
    const lines = source.split('\n')
    const inlineSelects: string[] = []

    let inQuestionColumns = false
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('const questionColumns')) inQuestionColumns = true
      if (inQuestionColumns && lines[i].includes('} as const')) inQuestionColumns = false

      if (!inQuestionColumns && lines[i].includes('questionText: questions.questionText')) {
        inlineSelects.push(`Line ${i + 1}: ${lines[i].trim()}`)
      }
    }

    expect(inlineSelects).toEqual([])
  })

  it('no hay transforms inline con manual field mapping (todo debe usar transformQuestion)', () => {
    // Buscar .map((q, index) => ({ id: q.id, question: q.questionText
    // que indique un transform manual duplicado
    const manualTransformPattern = /\.map\(\(q,?\s*(?:index|i)\)\s*=>\s*\(\{[\s\S]*?question:\s*q\.questionText/g
    const matches = source.match(manualTransformPattern) || []
    expect(matches.length).toBe(0)
  })
})
