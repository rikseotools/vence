// hooks/useDailyLimitEvent.ts
//
// Abre el modal de Premium cuando el SERVIDOR rechaza una respuesta por cupo diario agotado.
//
// ── POR QUÉ HACE FALTA (T-304, 30/07/2026) ──────────────────────────────────
// El muro que ve el usuario lo levanta el cliente con `isLimitReached`, que sale del contador de
// su CUENTA. Para un usuario normal basta: cuenta = persona. Pero quien cierra sesión y entra con
// otra cuenta empieza con el contador a 0, así que el cliente le deja responder y es el servidor
// quien rechaza —por el cupo del DISPOSITIVO— cuando la cola intenta guardar.
//
// Sin este puente, ese rechazo llegaba en la cola asíncrona y **no abría nada**: el usuario seguía
// respondiendo y sus respuestas se perdían en silencio. Perder el progreso sin explicación es peor
// que un muro claro.
//
// ── POR QUÉ UN EVENTO PROPIO Y NO EL QUE YA HABÍA ───────────────────────────
// Existe `vence:deviceLimitReached`, pero abre `DeviceLimitModal` — el de «ya tienes N
// dispositivos conectados, desconecta uno». Ese mensaje es FALSO aquí: no sobran equipos, se ha
// agotado el cupo del día. Reutilizarlo habría mandado al usuario a desconectar dispositivos que
// no son el problema. Cada modal dice una cosa distinta y hay que respetarlo.

import { useEffect } from 'react'

export const DAILY_LIMIT_EVENT = 'vence:dailyLimitReached'

/** Lo dispara la cola de guardado al recibir un 403 de cupo diario. */
export function dispatchDailyLimitEvent(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(DAILY_LIMIT_EVENT))
}

/**
 * Ejecuta `onLimit` cuando el servidor comunica que el cupo diario está agotado.
 *
 * El callback se guarda en una ref implícita a través de las dependencias: los layouts pasan
 * `setShowUpgradeModal`, que es estable, así que no hay riesgo de re-suscripción en bucle.
 */
export function useDailyLimitEvent(onLimit: () => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = () => onLimit()
    window.addEventListener(DAILY_LIMIT_EVENT, handler)
    return () => window.removeEventListener(DAILY_LIMIT_EVENT, handler)
  }, [onLimit])
}
