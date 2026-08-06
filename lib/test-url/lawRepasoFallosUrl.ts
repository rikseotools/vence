// lib/test-url/lawRepasoFallosUrl.ts
// Construye la URL del test de repaso de fallos de UNA ley concreta
// (/leyes/[law] → /test/repaso-fallos-v2). Lógica extraída de
// LawTestConfigurator para poder testearla de forma aislada.
//
// Contexto: el repaso de fallos desde una ley NO puede ir al test normal
// (/leyes/[law]/avanzado), que ignora el filtro de falladas y devuelve la
// ley entera (bug María 21/05/2026). /test/repaso-fallos-v2 calcula las
// falladas en el servidor (scope=law) sin pasar listas de IDs por la URL.
//
// T-603 (06/08/2026): aquella corrección arregló MEDIA queja. La misma persona
// reportaba dos cosas el 21/05 —«me incluye preguntas que no he fallado» y
// «aunque he acotado los artículos, me incluye preguntas fuera de mi selección»—
// y este salto resolvía la primera **creando** la segunda: se quedaba con la ley
// y tiraba los artículos. Volvió a reportarlo el 10/07 y el 05/08 (cuatro
// impugnaciones en cuatro minutos). Medido: hasta 6 de 20 preguntas servidas
// caían fuera de su selección por este camino, y 0 de 25 por `/avanzado`.
// Por eso `selectedArticles` es obligatorio en el tipo, no opcional.

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
  /**
   * Artículos acotados con las casillas del configurador, si los hay (T-603).
   *
   * **OBLIGATORIO a propósito, aunque pueda ir vacío.** Antes no existía y el
   * salto a esta URL tiraba la selección del usuario en silencio, dejándole las
   * casillas marcadas en pantalla mientras el test servía la ley entera. Que el
   * tipo lo exija es lo que impide que un llamador futuro vuelva a olvidarlo:
   * un test se puede borrar, esto no compila.
   *
   * Lista vacía = sin acotar (toda la ley), que es el comportamiento histórico.
   */
  selectedArticles: Array<string | number>
}

/**
 * Construye la URL a /test/repaso-fallos-v2 con scope de una ley concreta.
 * No incluye listas de IDs de PREGUNTAS — el servidor recalcula las falladas
 * (escalable). Los ARTÍCULOS sí viajan: son la acotación que pidió el usuario,
 * el servidor no puede adivinarla, y es la misma lista y el mismo nombre de
 * parámetro (`selected_articles`) que ya usa `/leyes/[law]/avanzado`.
 */
export function buildLawRepasoFallosUrl(p: LawRepasoFallosParams): string {
  const params = new URLSearchParams({
    law: p.lawShortName,
    order: mapModalOrderToEndpoint(p.failedQuestionsOrder),
    n: String(p.numQuestions),
    days: String(mapFailedPeriodToDays(p.failedPeriod)),
  })
  const url = `/test/repaso-fallos-v2?${params.toString()}`

  const arts = serializeSelectedArticles(p.selectedArticles)
  // URLSearchParams codifica el espacio como '+', y el parser de destino recibe
  // el valor ya decodificado por URLSearchParams.get() → '55 ter' sobrevive.
  return arts ? `${url}&selected_articles=${arts}` : url
}

/**
 * Serializa la selección de artículos al mismo formato que `/avanzado`: tokens
 * separados por coma, cada uno percent-encoded.
 *
 * Se codifica **por token** porque los identificadores no numéricos llevan
 * espacio (`55 ter`, `DA 1`) y sin codificar rompen el query string. La coma va
 * literal: ningún `article_number` la contiene, y así el valor se lee igual que
 * en el camino que ya funcionaba.
 *
 * Devuelve `''` cuando no hay nada que acotar, para que el llamador omita el
 * parámetro entero en vez de mandar `selected_articles=` vacío (que el parser
 * trataría igual, pero ensucia la URL y la telemetría).
 */
export function serializeSelectedArticles(articles: Array<string | number> | null | undefined): string {
  if (!articles || articles.length === 0) return ''
  const tokens = Array.from(
    new Set(
      articles
        .map((a) => String(a).trim())
        .filter((a) => a.length > 0)
    )
  )
  return tokens.map((t) => encodeURIComponent(t)).join(',')
}
