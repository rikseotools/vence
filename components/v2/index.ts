// components/v2/index.ts
// Exports centralizados de componentes V2

// Componentes principales
export { default as TestLayoutV2 } from './TestLayoutV2'

// Hooks
export { useTestState } from './hooks/useTestState'
export { useAnswerValidation } from './hooks/useAnswerValidation'

// Tipos
export type {
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
} from './types'

// Utilidades y constantes
export {
  isLegalArticle,
  formatTemaName,
  NON_LEGAL_CONTENT,
  PENDING_TEST_KEY,
  PSYCHOMETRIC_SUBTYPE_NAMES,
} from './types'

// Re-export de tipos de lib/api/tests para conveniencia
export type { TestLayoutQuestion, TestConfig } from '@/lib/api/tests'
