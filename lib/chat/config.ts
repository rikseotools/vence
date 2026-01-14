// lib/chat/config.ts
// Configuración y feature flags para el sistema de chat

/**
 * Feature flags para el sistema de chat
 *
 * USE_CHAT_V2: Habilita la nueva arquitectura de chat (chat-v2)
 * - false: Usa /api/ai/chat (arquitectura actual)
 * - true: Usa /api/ai/chat-v2 (nueva arquitectura DDD)
 *
 * Proceso de migración:
 * 1. Desplegar con USE_CHAT_V2 = false (default)
 * 2. Probar manualmente chat-v2 en producción
 * 3. Cambiar a true para un grupo de usuarios (A/B test)
 * 4. Si todo OK, cambiar a true para todos
 * 5. Eliminar el API antiguo
 */
export const CHAT_CONFIG = {
  /**
   * Usar nueva arquitectura de chat
   * Cambiar a true cuando esté listo para producción
   */
  USE_CHAT_V2: process.env.NEXT_PUBLIC_USE_CHAT_V2 === 'true',

  /**
   * Porcentaje de usuarios que usan chat-v2 (0-100)
   * Solo aplica si USE_CHAT_V2 es false
   * Permite rollout gradual
   */
  CHAT_V2_ROLLOUT_PERCENTAGE: parseInt(process.env.NEXT_PUBLIC_CHAT_V2_ROLLOUT || '0', 10),

  /**
   * Habilitar logging detallado en consola (desarrollo)
   */
  DEBUG_LOGGING: process.env.NODE_ENV === 'development',
} as const

/**
 * Determina si un usuario debe usar chat-v2
 * Basado en feature flag y rollout percentage
 */
export function shouldUseChatV2(userId?: string | null): boolean {
  // Si está habilitado globalmente, siempre usar v2
  if (CHAT_CONFIG.USE_CHAT_V2) {
    return true
  }

  // Si hay rollout gradual
  if (CHAT_CONFIG.CHAT_V2_ROLLOUT_PERCENTAGE > 0 && userId) {
    // Usar hash del userId para determinismo
    const hash = simpleHash(userId)
    const bucket = hash % 100
    return bucket < CHAT_CONFIG.CHAT_V2_ROLLOUT_PERCENTAGE
  }

  return false
}

/**
 * Hash simple para determinar bucket de usuario
 */
function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Obtiene la URL del endpoint de chat según la configuración
 */
export function getChatEndpoint(userId?: string | null): string {
  return shouldUseChatV2(userId) ? '/api/ai/chat-v2' : '/api/ai/chat'
}
