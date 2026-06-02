// lib/services/googleAds/errors.ts
//
// Normalización de errores de la Google Ads API a un tipo estable de la app.
// La librería `google-ads-api` lanza objetos `GoogleAdsFailure` con una forma
// anidada poco amigable; aquí la aplanamos para logs y observabilidad.
//
// Patrón: la capa de servicio LANZA `GoogleAdsError`. La observabilidad se
// emite en el borde (endpoints con `withErrorLogging`), no aquí — así el
// servicio queda puro y reutilizable en scripts CLI sin escribir en prod.

export interface GoogleAdsErrorDetail {
  errorCode?: string
  message: string
  trigger?: string
}

export class GoogleAdsError extends Error {
  readonly details: GoogleAdsErrorDetail[]
  readonly requestId?: string

  constructor(message: string, details: GoogleAdsErrorDetail[], requestId?: string) {
    super(message)
    this.name = 'GoogleAdsError'
    this.details = details
    this.requestId = requestId
  }
}

/**
 * Convierte cualquier excepción de la librería en un `GoogleAdsError` con
 * detalles legibles. Si no reconoce la forma, envuelve el mensaje crudo.
 */
export function normalizeGoogleAdsError(e: unknown): GoogleAdsError {
  if (e instanceof GoogleAdsError) return e

  // Forma típica: { errors: [{ error_code: {...}, message, trigger }], request_id }
  const anyErr = e as {
    errors?: Array<{
      error_code?: Record<string, unknown>
      message?: string
      trigger?: { string_value?: string }
    }>
    request_id?: string
    message?: string
  }

  if (Array.isArray(anyErr?.errors) && anyErr.errors.length > 0) {
    const details: GoogleAdsErrorDetail[] = anyErr.errors.map((err) => {
      const codeKey = err.error_code ? Object.keys(err.error_code)[0] : undefined
      const codeVal = codeKey ? err.error_code![codeKey] : undefined
      return {
        errorCode: codeKey ? `${codeKey}:${String(codeVal)}` : undefined,
        message: err.message || 'Error desconocido de Google Ads',
        trigger: err.trigger?.string_value,
      }
    })
    const summary = details.map((d) => d.message).join(' | ')
    return new GoogleAdsError(summary, details, anyErr.request_id)
  }

  const msg = anyErr?.message || String(e)
  return new GoogleAdsError(msg, [{ message: msg }], anyErr?.request_id)
}
