// lib/chat/domains/psychometric/index.ts
// Exports públicos del dominio Psychometric

export { PsychometricDomain, getPsychometricDomain } from './PsychometricDomain'
export { processPsychometricQuestion, getSubtypeGroup } from './PsychometricService'
export { buildPsychometricPrompt, normalizeOptions, getCorrectLetter } from './prompts'
export {
  validateLetterSequence,
  validateNumericSequence,
  type SequenceValidationResult,
} from './validators/sequenceValidator'
