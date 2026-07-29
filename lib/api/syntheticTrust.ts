// lib/api/syntheticTrust.ts
// Tráfico sintético de CONFIANZA — el que además de decir que es un canary, lo demuestra.
//
// POR QUÉ EXISTE (hallazgo 29/07/2026):
//   `isSyntheticRequest` (lib/api/syntheticRequest.ts) reconoce a los canaries por el header
//   `x-vence-canary`, que NO lleva secreto. Su propia documentación dice que eso es inofensivo
//   porque el marcador "solo se usa para DEGRADAR observabilidad, NUNCA para conceder acceso ni
//   saltar validaciones". Esa premisa dejó de ser cierta: `/api/questions/filtered` lo usaba
//   para EXIMIR del reto anti-scraping, así que cualquiera que escribiera esa línea en su
//   petición descargaba preguntas sin pasar el Turnstile. Comprobado contra producción:
//     sin header → 403 {"challengeRequired":true}
//     con header → 200 {"success":true,"questions":[…]}
//
//   La distinción que faltaba: **afirmar** que eres un canary (barato, falsificable, vale para
//   no ensuciar logs) frente a **demostrarlo** (con un secreto compartido, que es lo mínimo
//   para saltarse una defensa).
//
// CÓMO:
//   El canary manda `x-vence-canary-secret: <secreto>`. El secreto ya existe en los dos lados
//   (los canaries del backend usan `CRON_SECRET` para hablar con endpoints internos), así que
//   esto no añade infraestructura nueva; `CANARY_SECRET` permite separarlo el día que interese.
//
// LÍMITE DELIBERADO:
//   Esto NO autentica a un usuario ni concede datos que la sesión no tuviera: solo evita el
//   reto anti-bot a tráfico interno. Todo lo demás (auth, plan, scope) sigue igual.

/** Forma mínima de request: acceso a headers.get(). */
type HeaderReadable = {
  headers?: { get?: (name: string) => string | null } | null
} | null | undefined

export const CABECERA_CANARY_SECRETO = 'x-vence-canary-secret'

/**
 * Comparación en tiempo constante. Sin esto, comparar con `===` filtra por el tiempo de
 * respuesta cuántos caracteres iniciales acertaste, y un secreto se puede adivinar a base de
 * medir. Es barato hacerlo bien.
 */
export function comparacionSegura(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * ¿La petición viene de monitorización interna que PUEDE demostrarlo?
 *
 * Devuelve `false` si no hay secreto configurado: sin secreto no hay forma de distinguir a un
 * canary de un scraper, y ante la duda se protege (el canary se pondrá rojo y alguien lo mirará;
 * lo contrario sería abrir el banco de preguntas en silencio).
 */
export function esCanaryDeConfianza(request: HeaderReadable, secretoEsperado?: string | null): boolean {
  if (!secretoEsperado || secretoEsperado.length < 16) return false
  const enviado = request?.headers?.get?.(CABECERA_CANARY_SECRETO)
  if (!enviado) return false
  return comparacionSegura(enviado, secretoEsperado)
}

/** El secreto que se espera, con el de los crons como respaldo mientras no se separen. */
export function secretoCanaryEsperado(env: Record<string, string | undefined>): string | null {
  return env.CANARY_SECRET || env.CRON_SECRET || null
}
