// lib/chat/config.js
// Configuración de feature flags para el chat (versión JS para componentes client)

/**
 * Feature flags para el sistema de chat
 */
export const CHAT_CONFIG = {
  /**
   * Usar nueva arquitectura de chat
   * Se lee de NEXT_PUBLIC_USE_CHAT_V2
   */
  USE_CHAT_V2: process.env.NEXT_PUBLIC_USE_CHAT_V2 === 'true',

  /**
   * Porcentaje de usuarios que usan chat-v2 (0-100)
   * Se lee de NEXT_PUBLIC_CHAT_V2_ROLLOUT
   */
  CHAT_V2_ROLLOUT_PERCENTAGE: parseInt(process.env.NEXT_PUBLIC_CHAT_V2_ROLLOUT || '0', 10),
}

/**
 * Hash simple para determinar bucket de usuario
 */
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

/**
 * Determina si un usuario debe usar chat-v2
 */
export function shouldUseChatV2(userId) {
  // Si está habilitado globalmente, siempre usar v2
  if (CHAT_CONFIG.USE_CHAT_V2) {
    return true
  }

  // Si hay rollout gradual
  if (CHAT_CONFIG.CHAT_V2_ROLLOUT_PERCENTAGE > 0 && userId) {
    const hash = simpleHash(userId)
    const bucket = hash % 100
    return bucket < CHAT_CONFIG.CHAT_V2_ROLLOUT_PERCENTAGE
  }

  return false
}

/**
 * Obtiene la URL del endpoint de chat según la configuración
 */
export function getChatEndpoint(userId) {
  return shouldUseChatV2(userId) ? '/api/ai/chat-v2' : '/api/ai/chat'
}
