// lib/chat/shared/errors.ts
// Errores tipados para el chat

export class ChatError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ChatError'
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.context && { context: this.context }),
    }
  }
}

// Errores específicos

export class ValidationError extends ChatError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends ChatError {
  constructor(message = 'No autenticado') {
    super(message, 'AUTH_ERROR', 401)
    this.name = 'AuthenticationError'
  }
}

export class RateLimitError extends ChatError {
  constructor(
    message = 'Límite de mensajes alcanzado',
    public resetTime?: Date
  ) {
    super(message, 'RATE_LIMIT', 429, { resetTime: resetTime?.toISOString() })
    this.name = 'RateLimitError'
  }
}

export class OpenAIError extends ChatError {
  constructor(message: string, originalError?: Error) {
    super(message, 'OPENAI_ERROR', 502, {
      originalMessage: originalError?.message
    })
    this.name = 'OpenAIError'
  }
}

export class DatabaseError extends ChatError {
  constructor(message: string, originalError?: Error) {
    super(message, 'DB_ERROR', 500, {
      originalMessage: originalError?.message
    })
    this.name = 'DatabaseError'
  }
}

export class ArticleNotFoundError extends ChatError {
  constructor(lawName?: string) {
    super(
      lawName
        ? `No se encontraron artículos para ${lawName}`
        : 'No se encontraron artículos relevantes',
      'ARTICLES_NOT_FOUND',
      404,
      { lawName }
    )
    this.name = 'ArticleNotFoundError'
  }
}

/**
 * Helper para manejar errores de forma consistente
 */
export function handleError(error: unknown): ChatError {
  if (error instanceof ChatError) {
    return error
  }

  if (error instanceof Error) {
    return new ChatError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      { stack: error.stack }
    )
  }

  return new ChatError(
    'Error desconocido',
    'UNKNOWN_ERROR',
    500,
    { error }
  )
}
