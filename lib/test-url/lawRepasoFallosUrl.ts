// lib/test-url/lawRepasoFallosUrl.ts
// Construye la URL del test de repaso de fallos de UNA ley concreta
// (/leyes/[law] → /test/repaso-fallos-v2). Lógica extraída de
// LawTestConfigurator para poder testearla de forma aislada.
//
// Contexto: el repaso de fallos desde una ley NO puede ir al test normal
// (/leyes/[law]/avanzado), que ignora el filtro de falladas y devuelve la
// ley entera (bug María 21/05/2026). /test/repaso-fallos-v2 calcula las
// falladas en el servidor (scope=law) sin pasar listas de IDs por la URL.

// El modal de TestConfigurator usa una nomenclatura distinta de la del
// endpoint v2 (failedQuestionsOrderSchema). Cualquier valor desconocido
// cae a 'recent' (orden por defecto del endpoint).
const ORDER_MAP: Record<string, string> = {
  most_failed: 'most_failed',
  recent_failed: 'recent',
  oldest_failed: 'oldest',
  random: 'random',
}

// Periodo del modal → ventana en días. El endpoint v2 no tiene un sentinel
// "sin límite": un `days` alto (≈100 años) cubre todo el histórico.
const PERIOD_DAYS: Record<string, number> = {
  all: 36500,
  '7d': 7,
  '30d': 30,
}

/** Traduce el orden del modal de falladas al `orderBy` del endpoint v2. */
export function mapModalOrderToEndpoint(modalOrder: string | undefined): string {
  return ORDER_MAP[modalOrder ?? ''] ?? 'recent'
}

/** Traduce el periodo del modal (all/7d/30d) a la ventana en días del endpoint. */
export function mapFailedPeriodToDays(period: string | undefined): number {
  return PERIOD_DAYS[period ?? 'all'] ?? 36500
}

export interface LawRepasoFallosParams {
  /** short_name de la ley (ej. "Ley 9/2017"). */
  lawShortName: string
  /** Nº de preguntas elegido en el modal. */
  numQuestions: number
  /** Orden elegido en el modal (most_failed/recent_failed/oldest_failed/random). */
  failedQuestionsOrder?: string
  /** Periodo elegido en el modal (all/7d/30d). */
  failedPeriod?: string
}

/**
 * Construye la URL a /test/repaso-fallos-v2 con scope de una ley concreta.
 * No incluye listas de IDs — el servidor recalcula las falladas (escalable).
 */
export function buildLawRepasoFallosUrl(p: LawRepasoFallosParams): string {
  const params = new URLSearchParams({
    law: p.lawShortName,
    order: mapModalOrderToEndpoint(p.failedQuestionsOrder),
    n: String(p.numQuestions),
    days: String(mapFailedPeriodToDays(p.failedPeriod)),
  })
  return `/test/repaso-fallos-v2?${params.toString()}`
}
