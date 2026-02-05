// lib/chat/domains/verification/index.ts
// Exports públicos del dominio Verification

// Dominio principal
export { VerificationDomain, getVerificationDomain } from './VerificationDomain'

// Servicios
export {
  verifyAnswer,
  isVerificationRequest,
  hasQuestionToVerify,
  hasCorrectAnswer,
  extractVerificationInput,
  type VerificationInput,
  type VerificationResult,
} from './VerificationService'

export {
  detectErrorInResponse,
  analyzeQuestion,
  generateVerificationContext,
  formatQuestionForPrompt,
  compareAnswers,
  extractSuggestedAnswer,
  type ErrorDetectionResult,
  type QuestionAnalysis,
} from './ErrorDetector'

export {
  createAutoDispute,
  createUserDispute,
  getDisputesForQuestion,
  getUserPendingDisputes,
  hasOpenDisputes,
  getDisputeStats,
  generateDisputeConfirmationMessage,
  type Dispute,
  type DisputeType,
  type DisputeStatus,
  type DisputeResult,
  type DisputeStats,
} from './DisputeService'

// Detección de discrepancias y re-análisis
export {
  detectDiscrepancy,
  hasUncertaintyIndicators,
  type DiscrepancyResult,
} from './DiscrepancyDetector'

export {
  reanalyzeWithSuperiorModel,
} from './ReanalysisService'

// Schemas
export * from './schemas'
