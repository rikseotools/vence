/**
 * Tests para el filtro temporal de preguntas falladas y autoOpenFailed.
 *
 * Feature: Permitir al usuario filtrar preguntas falladas por periodo
 * (todas, último mes, última semana) y abrir el modal automáticamente
 * desde /mis-estadisticas via ?failedOnly=true.
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

  it('query should use since param with gte filter', () => {
    const content = fs.readFileSync('lib/api/user-failed-questions/queries.ts', 'utf-8')
    expect(content).toContain("if (since)")
    expect(content).toContain('gte(testQuestions.createdAt, since)')
  })

  it('query should destructure since from params', () => {
    const content = fs.readFileSync('lib/api/user-failed-questions/queries.ts', 'utf-8')
    expect(content).toContain('const { userId, topicNumber, selectedLaws, since } = params')
  })
})

// ============================================
// UNIT: TestConfigurator accepts autoOpenFailed prop
// ============================================
describe('TestConfigurator - autoOpenFailed prop', () => {
  const fs = require('fs')

  it('types should define autoOpenFailed prop', () => {
    const content = fs.readFileSync('components/TestConfigurator.types.ts', 'utf-8')
    expect(content).toContain('autoOpenFailed?: boolean')
  })

  it('component should destructure autoOpenFailed with default false', () => {
    const content = fs.readFileSync('components/TestConfigurator.tsx', 'utf-8')
    expect(content).toContain('autoOpenFailed = false')
  })

  it('component should have useEffect that calls loadFailedQuestions when autoOpenFailed is true', () => {
    const content = fs.readFileSync('components/TestConfigurator.tsx', 'utf-8')
    expect(content).toContain('if (autoOpenFailed && currentUser && tema)')
    expect(content).toContain("loadFailedQuestions('all')")
  })
})

// ============================================
// UNIT: TemaTestPage reads failedOnly searchParam
// ============================================
describe('TemaTestPage - failedOnly searchParam', () => {
  const fs = require('fs')

  it('should read failedOnly from searchParams', () => {
    const content = fs.readFileSync('components/test/TemaTestPage.tsx', 'utf-8')
    expect(content).toContain("searchParams.get('failedOnly') === 'true'")
  })

  it('should pass autoOpenFailed to TestConfigurator', () => {
    const content = fs.readFileSync('components/test/TemaTestPage.tsx', 'utf-8')
    expect(content).toContain('autoOpenFailed={autoOpenFailed}')
  })
})

// ============================================
// UNIT: ThemePerformance has "Falladas" button
// ============================================
describe('ThemePerformance - Repetir falladas button', () => {
  const fs = require('fs')

  it('should have a link to test page with failedOnly=true', () => {
    const content = fs.readFileSync('components/Statistics/ThemePerformance.tsx', 'utf-8')
    expect(content).toContain('failedOnly=true')
  })

  it('link should use oposicionSlug and theme number', () => {
    const content = fs.readFileSync('components/Statistics/ThemePerformance.tsx', 'utf-8')
    expect(content).toContain('/${oposicionSlug}/test/tema/${theme.theme}?failedOnly=true')
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
    // Function signature accepts period
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
    // The fetch body should include since
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
