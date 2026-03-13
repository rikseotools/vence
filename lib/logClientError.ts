// lib/logClientError.ts — Helper centralizado para logar errores client-side a BD
// Fire-and-forget: nunca lanza, nunca bloquea.

export function logClientError(
  endpoint: string,
  error: unknown,
  context?: {
    component?: string
    questionId?: string | null
    userId?: string | null
  }
): void {
  const err = error instanceof Error ? error : new Error(String(error))
  const errorType = err.name === 'ApiTimeoutError' ? 'timeout'
    : err.name === 'ApiNetworkError' ? 'network'
    : 'unknown'

  const prefix = context?.component ? `[${context.component} client] ` : ''

  fetch('/api/validation-error-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint,
      errorType,
      errorMessage: `${prefix}${err.message}`,
      questionId: context?.questionId || undefined,
      userId: context?.userId || undefined,
      httpStatus: 0,
      durationMs: 0,
    })
  }).catch(() => {})
}
