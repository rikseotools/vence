// lib/api/v2/complete-onboarding/index.ts
export {
  completeOnboardingRequestSchema,
  completeOnboardingResponseSchema,
  safeParseCompleteOnboardingRequest,
  type CompleteOnboardingRequest,
  type CompleteOnboardingResponse,
} from './schemas'

export {
  completeOnboarding,
} from './queries'
