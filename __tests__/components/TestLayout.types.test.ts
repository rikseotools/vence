/**
 * Type-level tests for TestLayout types.
 * These tests verify that the TypeScript types are correctly defined
 * by checking assignability at compile time. They don't run any runtime logic.
 */
import type {
  TestQuestion,
  LegacyQuestion,
  TestLayoutProps,
  TestLayoutConfig,
  AdaptiveQuestionsInput,
  AdaptiveCatalog,
  ValidateAnswerResponse,
  CompactStats,
  HotArticleInfo,
  AnsweredQuestionEntry,
  DetailedAnswerEntry,
} from '../../components/TestLayout.types'

// Helper: assert a value satisfies a type (compile-time only)
function assertType<T>(_value: T): void {}

describe('TestLayout types (compile-time)', () => {
  it('TestLayoutProps accepts legacy format questions', () => {
    const props: TestLayoutProps = {
      tema: 1,
      testNumber: 1,
      config: { name: 'Test Tema 1', description: 'Preguntas del tema 1' },
      questions: [
        {
          id: 'q1',
          question_text: 'Pregunta de prueba',
          option_a: 'A',
          option_b: 'B',
          option_c: 'C',
          option_d: 'D',
          explanation: 'Explicación',
          difficulty: 'medium',
          primary_article_id: null,
        },
      ],
    }
    assertType<TestLayoutProps>(props)
    expect(props.questions).toHaveLength(1)
  })

  it('TestLayoutProps accepts v2 format questions with options array', () => {
    const props: TestLayoutProps = {
      tema: 5,
      testNumber: 2,
      config: { name: 'Test Tema 5', description: 'Desc' },
      questions: [
        {
          id: 'q2',
          question: 'Pregunta v2',
          options: ['A', 'B', 'C', 'D'],
          explanation: null,
          difficulty: null,
          primary_article_id: null,
        },
      ],
    }
    assertType<TestLayoutProps>(props)
    expect(props.tema).toBe(5)
  })

  it('TestLayoutProps accepts adaptive questions input', () => {
    const catalog: AdaptiveCatalog = {
      neverSeen: { easy: [], medium: [], hard: [] },
      answered: { easy: [], medium: [], hard: [] },
    }
    const adaptiveInput: AdaptiveQuestionsInput = {
      isAdaptive: true,
      adaptiveCatalog: catalog,
      activeQuestions: [{ id: 'q1', question: 'Q', options: ['A', 'B', 'C', 'D'] }],
      questionPool: [],
    }
    const props: TestLayoutProps = {
      tema: 1,
      testNumber: 1,
      config: { name: 'Test', description: 'Desc' },
      questions: adaptiveInput,
    }
    assertType<TestLayoutProps>(props)
    expect(adaptiveInput.isAdaptive).toBe(true)
  })

  it('TestLayoutConfig requires name + description', () => {
    const config: TestLayoutConfig = {
      name: 'Test',
      description: 'Descripción',
    }
    assertType<TestLayoutConfig>(config)
    expect(config.name).toBe('Test')
  })

  it('TestLayoutConfig allows extra fields via index signature', () => {
    const config: TestLayoutConfig = {
      name: 'Test de Ley',
      description: 'Desc',
      isLawTest: true,
      lawShortName: 'CE',
      customExtraField: 'value',
    }
    assertType<TestLayoutConfig>(config)
    expect(config.isLawTest).toBe(true)
  })

  it('testNumber accepts number and string', () => {
    const propsWithNumber: TestLayoutProps = {
      tema: 1,
      testNumber: 1,
      config: { name: 'T', description: 'D' },
      questions: [],
    }
    const propsWithString: TestLayoutProps = {
      tema: 1,
      testNumber: 'repaso_fallos',
      config: { name: 'T', description: 'D' },
      questions: [],
    }
    assertType<TestLayoutProps>(propsWithNumber)
    assertType<TestLayoutProps>(propsWithString)
    expect(typeof propsWithNumber.testNumber).toBe('number')
    expect(typeof propsWithString.testNumber).toBe('string')
  })

  it('ValidateAnswerResponse has expected shape', () => {
    const response: ValidateAnswerResponse = {
      success: true,
      isCorrect: true,
      correctAnswer: 2,
      explanation: 'Artículo 14 CE',
    }
    assertType<ValidateAnswerResponse>(response)
    expect(response.isCorrect).toBe(true)
  })

  it('CompactStats has all required fields', () => {
    const stats: CompactStats = {
      percentage: 80,
      totalTime: 120,
      avgTimePerQuestion: 12,
      fastestTime: 5,
      slowestTime: 30,
      confidenceStats: { high: 5, medium: 3, low: 2 },
      maxCorrectStreak: 4,
      maxIncorrectStreak: 2,
      efficiency: 'Alta',
    }
    assertType<CompactStats>(stats)
    expect(stats.percentage).toBe(80)
  })

  it('HotArticleInfo has required fields and allows extras', () => {
    const info: HotArticleInfo = {
      is_hot: true,
      total_official_appearances: 5,
      unique_exams_count: 3,
      priority_level: 'critical',
      hotness_score: 50,
      target_oposicion: 'auxiliar-administrativo-estado',
      article_number: '14',
      law_name: 'CE',
      display_title: 'Artículo importante',
      also_appears_in_other_oposiciones: true,
    }
    assertType<HotArticleInfo>(info)
    expect(info.is_hot).toBe(true)
  })
})
