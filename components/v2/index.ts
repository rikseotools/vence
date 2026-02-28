// components/v2/index.ts
// Exports centralizados de componentes V2

// Componentes principales
export { default as TestLayoutV2 } from './TestLayoutV2'
export { default as DynamicTestAi } from './DynamicTestAi'
export { default as ExamLayoutV2 } from './ExamLayoutV2'

// Hooks
export { useTestState } from './hooks/useTestState'
export { useAnswerValidation } from './hooks/useAnswerValidation'

// Tipos
export type {
  // TestLayout
  TestLayoutV2Props,
  AnsweredQuestion,
  DetailedAnswer,
  TestSession,
  UserSession,
  DeviceInfo,
  TestLayoutState,
  HotArticleInfo,
  ValidateAnswerResult,
  SaveAnswerResult,
  TestAction,

  // DynamicTestAi
  DynamicTestAiProps,
  DifficultyConfig,
  AIGeneratedQuestion,
  AITestData,
  AIAnsweredQuestion,

  // ExamLayout
  ExamLayoutV2Props,
  ExamQuestion,
  ExamValidationResult,
  ExamValidationResponse,
  MotivationalMessageData,

} from './types'

// Utilidades y constantes
export {
  isLegalArticle,
  formatTemaName,
  getMotivationalMessage,
  NON_LEGAL_CONTENT,
  PENDING_TEST_KEY,
  DIFFICULTY_CONFIGS,
  PSYCHOMETRIC_SUBTYPE_NAMES,
} from './types'

// Re-export de tipos de lib/api/tests para conveniencia
export type { TestLayoutQuestion, TestConfig } from '@/lib/api/tests'
