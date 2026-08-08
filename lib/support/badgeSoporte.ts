// lib/support/badgeSoporte.ts
// [T-378] Núcleo puro del badge del botón 💬 Soporte — mismo patrón que
// `estadoIconoRecompensas` (lib/referrals/logic.ts): decide qué pintar a partir
// de un número plano, sin BD y sin React, para poder fijarlo en tests.
//
// Qué cuenta este badge (y por qué vive fuera de la campana): respuestas a
// conversaciones de soporte (feedback) e impugnaciones resueltas/rechazadas/
// alegadas sin leer — "una conversación dirigida a esa persona que espera
// lectura" (decisión de Manuel, 31/07/2026). Antes se sumaban dentro del
// badge de la campana junto a avisos de estudio opcionales y perecederos, así
// que ninguno de los dos números significaba nada: un usuario con impugnaciones
// sin leer nunca veía la campana llegar a 0 por mucho que despachara sus
// avisos de estudio (caso real: 13 respuestas de impugnación sin leer dejaban
// el badge clavado en "9+").

export interface EstadoBadgeSoporte {
  hayNovedad: boolean
  etiqueta: string | null
}

export function estadoBadgeSoporte(unread: number): EstadoBadgeSoporte {
  const n = Number.isFinite(unread) && unread > 0 ? Math.trunc(unread) : 0
  if (n <= 0) return { hayNovedad: false, etiqueta: null }
  // Mismo tope "9+" que ya usaba la campana (components/NotificationBell.tsx).
  return { hayNovedad: true, etiqueta: n > 9 ? '9+' : String(n) }
}
