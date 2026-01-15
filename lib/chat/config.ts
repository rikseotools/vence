// lib/chat/config.ts
// Configuración del sistema de chat v2

/**
 * Configuración del chat
 *
 * NOTA: La versión v1 (/api/ai/chat) fue eliminada.
 * Ahora solo existe v2 (/api/ai/chat-v2) con arquitectura DDD.
 */
export const CHAT_CONFIG = {
  /**
   * Habilitar logging detallado en consola (desarrollo)
   */
  DEBUG_LOGGING: process.env.NODE_ENV === 'development',
} as const

/**
 * Obtiene la URL del endpoint de chat
 * Siempre usa v2 (la única versión disponible)
 */
export function getChatEndpoint(_userId?: string | null): string {
  return '/api/ai/chat-v2'
}

/**
 * @deprecated Ya no hay v1, siempre retorna true
 */
export function shouldUseChatV2(_userId?: string | null): boolean {
  return true
}
