// lib/chat/shared/logger.ts
// Logging estructurado para el chat

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  domain?: string
  userId?: string
  questionId?: string
  duration?: number
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const CURRENT_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[CURRENT_LEVEL]
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const prefix = context?.domain ? `[${context.domain}]` : '[chat]'

  let formatted = `${timestamp} ${level.toUpperCase()} ${prefix} ${message}`

  if (context) {
    const { domain, ...rest } = context
    if (Object.keys(rest).length > 0) {
      formatted += ` ${JSON.stringify(rest)}`
    }
  }

  return formatted
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, context))
    }
  },

  info(message: string, context?: LogContext) {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, context))
    }
  },

  warn(message: string, context?: LogContext) {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, context))
    }
  },

  error(message: string, error?: Error | unknown, context?: LogContext) {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, context))
      if (error instanceof Error) {
        console.error(error.stack)
      } else if (error) {
        console.error(error)
      }
    }
  },

  /**
   * Log con timing automático
   */
  timed<T>(name: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
    const start = Date.now()
    return fn().then(
      (result) => {
        this.info(`${name} completed`, { ...context, duration: Date.now() - start })
        return result
      },
      (error) => {
        this.error(`${name} failed`, error, { ...context, duration: Date.now() - start })
        throw error
      }
    )
  },
}

export type Logger = typeof logger
