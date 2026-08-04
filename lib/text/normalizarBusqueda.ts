// lib/text/normalizarBusqueda.ts — normalizar texto para BUSCAR. [T-521]
//
// ── QUÉ ES Y QUÉ NO ─────────────────────────────────────────────────────────────────────────
//
// Esto prepara texto para COMPARARLO con lo que alguien ha escrito en una caja de búsqueda.
// **No sirve para generar slugs**, aunque se parezca: un slug tiene que ser estable y
// reversible (y por eso `lawSlugSync.ts`, `boeScrapingUtils.ts` y compañía tienen su propia
// versión, que además une con guiones). Mezclar los dos usos haría que cambiar la búsqueda
// renombrara URLs. Son parecidos y NO son lo mismo.
//
// ── POR QUÉ HACE FALTA ──────────────────────────────────────────────────────────────────────
//
// El desplegable de las migas filtraba con `label.toLowerCase().includes(term)`, o sea que
// **exigía la tilde**. Medido sobre las etiquetas reales del catálogo:
//
//   escribir «almería» → encuentra    ·  escribir «almeria» → NO encuentra
//   escribir «león»    → encuentra    ·  escribir «leon»    → NO encuentra
//
// Y nadie escribe tildes en un buscador. Con León, Almería, Cádiz, Córdoba, Jaén, Alcalá y
// Castellón en el catálogo, eso es una parte grande de las oposiciones inalcanzables por su
// nombre. Lo destapó Manuel buscando «universidad» (04/08/2026).
//
// ⚠️ **La `ñ` también se queda en `n`**, y conviene saberlo porque el código engaña: el
// `[^a-z0-9ñ\s]` de abajo parece conservarla, pero para cuando se ejecuta la `ñ` ya se ha
// descompuesto en `n` + virgulilla y el barrido de tildes se ha llevado la segunda. El
// comentario original (heredado del catálogo del chat) afirmaba lo contrario; lo destapó su
// propio test.
//
// Para BUSCAR está bien, incluso mejor: quien escribe «espana» encuentra «España». Sería un
// problema si distinguir «año» de «ano» importara, y en nombres de oposición no importa. Se
// deja documentado en vez de «arreglado» porque el comportamiento es el deseado; lo que estaba
// mal era la descripción.

/**
 * Minúsculas, sin tildes, sin puntuación y con los espacios colapsados.
 *
 * Se aplica a los DOS lados de la comparación (lo escrito y lo comparado). Aplicarlo solo a uno
 * es peor que no aplicarlo: haría que «Almería» dejara de encontrarse a sí misma.
 */
export function normalizarBusqueda(s: string | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** ¿`texto` contiene lo escrito en `termino`, ignorando tildes, mayúsculas y puntuación? */
export function coincideBusqueda(texto: string | null | undefined, termino: string | null | undefined): boolean {
  const t = normalizarBusqueda(termino)
  if (!t) return true // sin término no se filtra nada
  return normalizarBusqueda(texto).includes(t)
}
