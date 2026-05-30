/**
 * Helper de jitter para crons periódicos.
 *
 * Problema (incidente 30/05/2026 ~10:25 UTC, 503 user-facing):
 *   NestJS @Cron con expresión "cada 5 min" dispara TODOS los crons que
 *   comparten esa expresión al segundo 0 del minuto múltiplo de 5. A las
 *   10:25:00 tickearon simultáneamente: refresh-rankings (3.4s) +
 *   alerts-engine (3.2s) + 4 canaries (0.4-0.8s) → pool BD backend
 *   (max:10) saturado durante ~10s → /api/v2/answer-and-save 503 con
 *   espera 10-17s.
 *
 * Solución: cada cron arranca con un delay aleatorio en [0, maxMs).
 *   Los ticks siguen siendo 5/hora pero NO colisionan al mismo segundo.
 *
 * NO usar en canary-answer-save (debe correr puntual para detectar cuelgues
 * del POST con precisión temporal).
 */
export function jitter(maxMs: number): Promise<void> {
  if (maxMs <= 0) return Promise.resolve();
  const delayMs = Math.floor(Math.random() * maxMs);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
