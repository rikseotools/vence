// lib/api/filtered-questions/index.ts - Exports del módulo de preguntas filtradas

// Schemas y tipos
export {
  sectionFilterSchema,
  getFilteredQuestionsRequestSchema,
  getFilteredQuestionsResponseSchema,
  filteredQuestionSchema,
  articleResponseSchema,
  questionMetadataSchema,
  countFilteredQuestionsRequestSchema,
  countFilteredQuestionsResponseSchema,
  validateGetFilteredQuestions,
  safeParseGetFilteredQuestions,
  safeParseCountFilteredQuestions,
  type SectionFilter,
  type GetFilteredQuestionsRequest,
  type GetFilteredQuestionsResponse,
  type FilteredQuestion,
  type ArticleResponse,
  type QuestionMetadata,
  type CountFilteredQuestionsRequest,
  type CountFilteredQuestionsResponse,
} from './schemas'

// Queries
export {
  getFilteredQuestions,
  countFilteredQuestions,
} from './queries'
