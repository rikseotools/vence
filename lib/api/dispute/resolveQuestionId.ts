// lib/api/dispute/resolveQuestionId.ts
//
// Resuelve QUÉ pregunta se está impugnando, SOLO desde fuentes explícitas y vivas.
//
// Historia del bug (21-22/07/2026, caso María José, premium): FeedbackModal adivinaba la
// pregunta desde `localStorage.currentQuestionId` (y un scan del DOM). Ese valor PERSISTE
// entre páginas y sesiones, así que en /soporte —donde no hay ninguna pregunta a la vista—
// devolvía una pregunta VIEJA de un test anterior. Resultado: su impugnación con texto sobre
// "Acerca de" quedó colgada de OTRA pregunta ("Win+L") que ni siquiera había respondido, y la
// confirmación solo mostraba "ID: xxxxxxxx…" (sin el texto), así que no podía darse cuenta.
//
// REGLA (robusta, sin adivinar): la pregunta impugnada NUNCA se infiere de estado ambiente o
// persistido. Solo vale una fuente EXPLÍCITA y viva, por prioridad:
//   1) `propQuestionId` — el llamador SABE qué pregunta es (botón "Impugnar pregunta" del test).
//   2) URL de una página de pregunta concreta (`/pregunta/<uuid>`).
//   3) `contextQuestionId` — el QuestionContext VIVO (lo fija el TestLayout y se limpia al salir
//      del test; en /soporte, sin test montado, es null → correcto: no hay pregunta que impugnar).
// Si ninguna resuelve → null. El modal muestra "no se detectó ninguna pregunta" y guía al botón
// inline. Nunca se cuelga una impugnación de una pregunta adivinada.

// UUID v4-ish (mismo shape que valida el endpoint). Estricto: 8-4-4-4-12 hex.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const QUESTION_URL_RE = /pregunta\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i

export interface ResolveDisputeQuestionIdInput {
  /** Prop explícita del llamador (máxima prioridad). */
  propQuestionId?: string | null
  /** window.location.pathname (para páginas /pregunta/<uuid>). */
  urlPath?: string | null
  /** Id de la pregunta VIVA en QuestionContext (null si no hay test montado). */
  contextQuestionId?: string | null
}

function cleanId(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return UUID_RE.test(s) ? s : null
}

/**
 * Devuelve el id de la pregunta a impugnar, o null si no hay una fuente explícita fiable.
 * IMPORTANTE: NO consulta localStorage ni el DOM — esas eran las fuentes que colgaban la
 * impugnación de una pregunta stale. Solo prop → URL → contexto vivo.
 */
export function resolveDisputeQuestionId(input: ResolveDisputeQuestionIdInput): string | null {
  const prop = cleanId(input.propQuestionId)
  if (prop) return prop

  const m = (input.urlPath ?? '').match(QUESTION_URL_RE)
  const fromUrl = cleanId(m?.[1])
  if (fromUrl) return fromUrl

  const ctx = cleanId(input.contextQuestionId)
  if (ctx) return ctx

  return null
}
