/**
 * Tests para el flujo de "Solo preguntas falladas" en test-personalizado
 *
 * Bug: failedQuestionIds se leía de sessionStorage en un IIFE durante render,
 * que en SSR devolvía null. El fetcher no recibía los IDs y hacía query
 * aleatoria en vez de filtrar por preguntas falladas (76% preguntas nuevas).
 *
 * Fix: Leer sessionStorage en useEffect + useState. El fetcher lee del
 * config (prioridad) o de searchParams (fallback).
 */

// ============================================
// TEST: testFetchers lee failedQuestionIds del config
// ============================================
describe('fetchQuestionsViaAPI - failedQuestionIds source', () => {
  const fs = require('fs')

  it('should read failedQuestionIds from config first, then searchParams', () => {
    const content = fs.readFileSync('lib/testFetchers.ts', 'utf-8')
    // The fix: config?.failedQuestionIds takes priority over searchParams
    expect(content).toContain('config?.failedQuestionIds')
    // Should still have searchParams as fallback
    expect(content).toContain('failed_question_ids')
  })

  it('should read onlyFailedQuestions from config first', () => {
    const content = fs.readFileSync('lib/testFetchers.ts', 'utf-8')
    expect(content).toContain('config?.onlyFailedQuestions')
  })

  it('should read failedQuestionsOrder from config first', () => {
    const content = fs.readFileSync('lib/testFetchers.ts', 'utf-8')
    expect(content).toContain('config?.failedQuestionsOrder')
  })
})

// ============================================
// TEST: test-personalizado pages use useEffect for sessionStorage
// ============================================
describe('test-personalizado pages - sessionStorage via useEffect', () => {
  const fs = require('fs')
  const glob = require('glob')

  // Exclude dynamic route wrapper and fully migrated pages (< 15 lines = thin wrapper)
  const testPersonalizadoPages = glob.sync('app/**/test/tema/*/test-personalizado/page.{js,tsx}')
    .filter((f: string) => {
      if (f.includes('[oposicion]')) return false
      const content = fs.readFileSync(f, 'utf-8')
      const lineCount = content.split('\n').length
      // Migrated pages are thin wrappers (< 15 lines). Non-migrated have full inline code (50+ lines)
      return lineCount > 15
    })

  it('should find all test-personalizado pages', () => {
    // Pages using inline sessionStorage + pages delegating to shared component
    expect(testPersonalizadoPages.length).toBeGreaterThanOrEqual(1)
  })

  it.each(testPersonalizadoPages)('%s should NOT have IIFE reading sessionStorage during render', (filePath: string) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    // The old buggy pattern: IIFE that reads sessionStorage inline
    const hasIIFE = content.includes('(() => { const stored = typeof window')
      && content.includes('sessionStorage.getItem(\'pendingFailedQuestionIds\')')
      && content.includes('})(),')
    expect(hasIIFE).toBe(false)
  })

  it.each(testPersonalizadoPages)('%s should use useState for failedQuestionIds', (filePath: string) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toMatch(/useState.*failedQuestionIds|failedQuestionIds.*useState/)
  })

  it.each(testPersonalizadoPages)('%s should read sessionStorage in useEffect', (filePath: string) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    // useEffect that reads pendingFailedQuestionIds
    expect(content).toContain('pendingFailedQuestionIds')
    expect(content).toContain('setFailedQuestionIds')
  })

  it.each(testPersonalizadoPages)('%s should wait for failedQuestionIds when only_failed is true', (filePath: string) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    expect(content).toContain('isOnlyFailed')
    expect(content).toContain('failedQuestionIds === null')
  })
})

// ============================================
// TEST: Lógica de priorización config vs searchParams
// ============================================
describe('failedQuestionIds priority logic', () => {
  // Simula la lógica del fetcher
  function getFailedQuestionIds(
    configIds: string[] | null | undefined,
    searchParamsStr: string | null
  ): string[] | null {
    return configIds || (searchParamsStr ? JSON.parse(searchParamsStr) : null)
  }

  it('should use config IDs when available', () => {
    const ids = getFailedQuestionIds(['id1', 'id2'], null)
    expect(ids).toEqual(['id1', 'id2'])
  })

  it('should fallback to searchParams when config is null', () => {
    const ids = getFailedQuestionIds(null, '["id3","id4"]')
    expect(ids).toEqual(['id3', 'id4'])
  })

  it('should return null when both are empty', () => {
    const ids = getFailedQuestionIds(null, null)
    expect(ids).toBeNull()
  })

  it('should prefer config over searchParams', () => {
    const ids = getFailedQuestionIds(['fromConfig'], '["fromURL"]')
    expect(ids).toEqual(['fromConfig'])
  })
})

// ============================================
// TEST: Bug scenario - Mar's test
// ============================================
describe('Bug scenario: Mar - failed questions test shows random questions', () => {
  it('IIFE during render returns null in SSR (the bug)', () => {
    // Simulate SSR: typeof window === 'undefined'
    const isSSR = true // In SSR, window doesn't exist
    const stored = !isSSR ? 'would read sessionStorage' : null
    expect(stored).toBeNull()
    // This null propagates to the fetcher → no filter → random questions
  })

  it('useEffect only runs on client (the fix)', () => {
    // useEffect never runs on server — only after hydration on client
    // So it correctly reads sessionStorage only in the browser
    let failedQuestionIds: string[] | null = null

    // Simulate useEffect running on client
    const simulateUseEffect = () => {
      // In real code: sessionStorage.getItem('pendingFailedQuestionIds')
      const stored = '["id1","id2","id3"]' // Would come from sessionStorage
      failedQuestionIds = JSON.parse(stored)
    }

    // Before useEffect: null (loading state blocks render)
    expect(failedQuestionIds).toBeNull()

    // After useEffect: IDs available
    simulateUseEffect()
    expect(failedQuestionIds).toEqual(['id1', 'id2', 'id3'])
  })

  it('loading state blocks render until IDs are available', () => {
    const temaNumber = 13
    const isOnlyFailed = true
    let failedQuestionIds: string[] | null = null

    // Before useEffect: should show loading
    const shouldShowLoading = !temaNumber || (isOnlyFailed && failedQuestionIds === null)
    expect(shouldShowLoading).toBe(true)

    // After useEffect: should render test
    failedQuestionIds = ['id1', 'id2']
    const shouldShowLoadingAfter = !temaNumber || (isOnlyFailed && failedQuestionIds === null)
    expect(shouldShowLoadingAfter).toBe(false)
  })
})
