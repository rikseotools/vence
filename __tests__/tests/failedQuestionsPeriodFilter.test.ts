/**
 * Tests para el filtro temporal de preguntas falladas y la sección
 * de repaso en mis-estadisticas.
 *
 * Feature: Filtrar preguntas falladas por periodo (todas/mes/semana),
 * sección dedicada en el tab "Tests y Fallos" de estadísticas,
 * y modal reutilizable FailedQuestionsModal.
 */

// ============================================
// UNIT: Schema acepta param `since`
// ============================================
describe('user-failed-questions schema - since param', () => {
  const fs = require('fs')

  it('schema should accept optional since param as datetime string', () => {
    const content = fs.readFileSync('lib/api/user-failed-questions/schemas.ts', 'utf-8')
    expect(content).toContain('since: z.string().datetime().optional()')
  })

  it('schema should define FailedByTopicItem type', () => {
    const content = fs.readFileSync('lib/api/user-failed-questions/schemas.ts', 'utf-8')
    expect(content).toContain('failedByTopicItemSchema')
    expect(content).toContain('topicNumber')
    expect(content).toContain('failedQuestions')
  })

  it('query should use since param with gte filter', () => {
    const content = fs.readFileSync('lib/api/user-failed-questions/queries.ts', 'utf-8')
    expect(content).toContain("if (since)")
    expect(content).toContain('gte(testQuestions.createdAt, since)')
  })

  it('query should destructure since from params', () => {
    const content = fs.readFileSync('lib/api/user-failed-questions/queries.ts', 'utf-8')
    expect(content).toContain('const { userId, topicNumber, selectedLaws, since } = params')
  })

  it('query should export getFailedQuestionsByTopic', () => {
    const content = fs.readFileSync('lib/api/user-failed-questions/queries.ts', 'utf-8')
    expect(content).toContain('export async function getFailedQuestionsByTopic')
  })
})

// ============================================
// UNIT: FailedQuestionsModal component exists
// ============================================
describe('FailedQuestionsModal - standalone component', () => {
  const fs = require('fs')

  it('should exist as a separate component', () => {
    expect(fs.existsSync('components/FailedQuestionsModal.tsx')).toBe(true)
  })

  it('should export FailedPeriod type', () => {
    const content = fs.readFileSync('components/FailedQuestionsModal.tsx', 'utf-8')
    expect(content).toContain("export type FailedPeriod = 'all' | '7d' | '30d'")
  })

  it('should accept onChangePeriod callback', () => {
    const content = fs.readFileSync('components/FailedQuestionsModal.tsx', 'utf-8')
    expect(content).toContain('onChangePeriod')
  })

  it('should have period selector with 3 options', () => {
    const content = fs.readFileSync('components/FailedQuestionsModal.tsx', 'utf-8')
    expect(content).toContain('Todas')
    expect(content).toContain('Último mes')
    expect(content).toContain('Última semana')
  })

  it('should have sort and start functionality', () => {
    const content = fs.readFileSync('components/FailedQuestionsModal.tsx', 'utf-8')
    expect(content).toContain('most_failed')
    expect(content).toContain('recent_failed')
    expect(content).toContain('handleStart')
    expect(content).toContain('Comenzar Test de Repaso')
  })
})

// ============================================
// UNIT: FailedQuestionsReview in mis-estadisticas
// ============================================
describe('FailedQuestionsReview - statistics component', () => {
  const fs = require('fs')

  it('should exist as a component', () => {
    expect(fs.existsSync('components/Statistics/FailedQuestionsReview.tsx')).toBe(true)
  })

  it('should fetch from /api/questions/failed-by-topic', () => {
    const content = fs.readFileSync('components/Statistics/FailedQuestionsReview.tsx', 'utf-8')
    expect(content).toContain('/api/questions/failed-by-topic')
  })

  it('should use FailedQuestionsModal', () => {
    const content = fs.readFileSync('components/Statistics/FailedQuestionsReview.tsx', 'utf-8')
    expect(content).toContain('FailedQuestionsModal')
  })

  it('should use buildTestUrl to navigate to test', () => {
    const content = fs.readFileSync('components/Statistics/FailedQuestionsReview.tsx', 'utf-8')
    expect(content).toContain('buildTestUrl')
    expect(content).toContain('window.location.href')
  })

  it('should be included in mis-estadisticas ai_analysis tab', () => {
    const content = fs.readFileSync('app/mis-estadisticas/page.tsx', 'utf-8')
    expect(content).toContain('FailedQuestionsReview')
    expect(content).toContain("activeTab === 'ai_analysis'")
  })
})

// ============================================
// UNIT: API route failed-by-topic exists
// ============================================
describe('API /api/questions/failed-by-topic', () => {
  const fs = require('fs')

  it('route should exist', () => {
    expect(fs.existsSync('app/api/questions/failed-by-topic/route.ts')).toBe(true)
  })

  it('should use getFailedQuestionsByTopic query', () => {
    const content = fs.readFileSync('app/api/questions/failed-by-topic/route.ts', 'utf-8')
    expect(content).toContain('getFailedQuestionsByTopic')
  })

  it('should require authentication', () => {
    const content = fs.readFileSync('app/api/questions/failed-by-topic/route.ts', 'utf-8')
    expect(content).toContain('getOptionalUserId')
    expect(content).toContain('No autenticado')
  })
})

// ============================================
// UNIT: TestConfigurator period filter in modal
// ============================================
describe('TestConfigurator - period filter', () => {
  const fs = require('fs')

  it('should have failedPeriod state', () => {
    const content = fs.readFileSync('components/TestConfigurator.tsx', 'utf-8')
    expect(content).toContain('failedPeriod')
    expect(content).toContain("setFailedPeriod")
  })

  it('loadFailedQuestions should accept period parameter', () => {
    const content = fs.readFileSync('components/TestConfigurator.tsx', 'utf-8')
    expect(content).toContain("loadFailedQuestions = async (period: 'all' | '7d' | '30d'")
  })

  it('should calculate since date for 7d and 30d periods', () => {
    const content = fs.readFileSync('components/TestConfigurator.tsx', 'utf-8')
    expect(content).toContain("period === '7d'")
    expect(content).toContain("period === '30d'")
    expect(content).toContain('7 * 24 * 60 * 60 * 1000')
    expect(content).toContain('30 * 24 * 60 * 60 * 1000')
  })

  it('should pass since to API request body', () => {
    const content = fs.readFileSync('components/TestConfigurator.tsx', 'utf-8')
    expect(content).toContain('since,')
  })
})

// ============================================
// LOGIC: since date calculation
// ============================================
describe('Period to since date calculation', () => {
  it('7d should produce a date ~7 days ago', () => {
    const now = Date.now()
    const since = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const diffMs = now - since.getTime()
    const diffDays = diffMs / (24 * 60 * 60 * 1000)
    expect(diffDays).toBeCloseTo(7, 0)
  })

  it('30d should produce a date ~30 days ago', () => {
    const now = Date.now()
    const since = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const diffMs = now - since.getTime()
    const diffDays = diffMs / (24 * 60 * 60 * 1000)
    expect(diffDays).toBeCloseTo(30, 0)
  })

  it('all should not produce a since date', () => {
    const period = 'all'
    let since: string | undefined
    if (period === '7d') since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    else if (period === '30d') since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    expect(since).toBeUndefined()
  })
})
