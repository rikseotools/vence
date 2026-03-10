import type { TestStartConfig, TestMode } from '@/components/TestConfigurator.types'

interface BuildTestUrlParams {
  basePath: string
  temaNumber: number
  testMode: TestMode
  config: TestStartConfig
}

export function buildTestUrl({ basePath, temaNumber, testMode, config }: BuildTestUrlParams): string {
  const params = new URLSearchParams({
    n: config.numQuestions.toString(),
    exclude_recent: config.excludeRecent.toString(),
    recent_days: config.recentDays.toString(),
    difficulty_mode: config.difficultyMode,
  })

  if (config.onlyOfficialQuestions) params.set('only_official', 'true')
  if (config.focusEssentialArticles) params.set('focus_essential', 'true')
  if (config.focusWeakAreas) params.set('focus_weak', 'true')
  if (config.adaptiveMode) params.set('adaptive', 'true')
  if (config.onlyFailedQuestions) params.set('only_failed', 'true')
  if (config.timeLimit) params.set('time_limit', config.timeLimit.toString())

  if (config.failedQuestionIds?.length) {
    params.set('failed_question_ids', JSON.stringify(config.failedQuestionIds))
  }
  if (config.failedQuestionsOrder) {
    params.set('failed_questions_order', config.failedQuestionsOrder)
  }
  if (config.selectedLaws?.length > 0) {
    params.set('selected_laws', JSON.stringify(config.selectedLaws))
  }
  if (config.selectedArticlesByLaw && Object.keys(config.selectedArticlesByLaw).length > 0) {
    params.set('selected_articles_by_law', JSON.stringify(config.selectedArticlesByLaw))
  }
  if (config.selectedSectionFilters?.length > 0) {
    params.set('selected_section_filters', JSON.stringify(config.selectedSectionFilters))
  }

  const testPath = testMode === 'examen' ? 'test-examen' : 'test-personalizado'
  return `${basePath}/test/tema/${temaNumber}/${testPath}?${params.toString()}`
}
