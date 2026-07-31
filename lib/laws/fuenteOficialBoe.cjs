/**
 * Lector de la fuente OFICIAL del BOE para `scripts/actualizar-articulo-oficial.cjs`.
 *
 * ── Por qué existe (T-376, 31/07/2026) ──
 * `actualizar-articulo-oficial.cjs` es la puerta registrada para «pon al día el `content` de un
 * artículo contra su fuente», pero **solo sabía leer EUR-Lex**. Para las leyes del BOE —que son la
 * mitad del catálogo— no había ninguna: la única herramienta que escribía `content` contra el BOE
 * era `reactivar-articulo-boe.cjs`, que hace otra cosa (reactivar UN artículo apagado).
 *
 * El hueco se notó al preparar un lote de generación: el Paso 1 dijo que tres artículos del RDL
 * 2/2004 no coinciden con el BOE —dos anteriores a una reforma de marzo de 2026 y uno **truncado a
 * la mitad**, 2.450 caracteres de 4.805— y no había forma de arreglarlos con la puerta buena.
 *
 * ── Qué NO hace, a propósito ──
 * Este módulo **solo LEE**. Toda la política (qué clases se reescriben, qué se bloquea, la
 * transacción y el ROLLBACK si el resultado no queda `idéntico`) sigue viviendo donde ya estaba,
 * en `actualizarArticuloGuardas.js` y en el script. Añadir una fuente no puede ser una excusa para
 * abrir una segunda puerta con otros criterios.
 *
 * ── Diferencia de forma con EUR-Lex, que es la razón de que haga falta un adaptador ──
 * EUR-Lex se baja UNA vez y se recorta en memoria. El BOE consolidado sirve **un bloque por
 * artículo**, así que hay que resolver primero el id del bloque contra el índice y luego pedir ese
 * bloque. Por eso `articulo()` es asíncrono y el índice se cachea.
 */
const path = require('path')
const {
  bloqueVigente,
  mapaBloquesPorArticulo,
  bloqueDeArticulo,
} = require(path.join(__dirname, 'boeBloqueVigente'))

const API = 'https://www.boe.es/datosabiertos/api/legislacion-consolidada/id'

/**
 * ¿Es un identificador de norma consolidada del BOE? (`BOE-A-2004-4214`).
 *
 * Se excluyen a propósito los `DOUE-*`: son el espejo del diario europeo, que reproduce el acto
 * **ORIGINAL con erratas** y no incorpora las correcciones. Para normas de la UE la fuente buena es
 * el consolidado de EUR-Lex, que es lo que ya lee la otra rama.
 */
function esIdBoe(id) {
  return /^BOE-A-\d{4}-\d+$/i.test(String(id || '').trim())
}

/**
 * Abre la fuente y devuelve un lector con `articulo(numero) → {texto, rubrica, notaVigencia}`.
 *
 * `fetchImpl` se inyecta para poder testear sin red.
 */
async function abrirFuenteBoe(id, { log = () => {}, fetchImpl = fetch } = {}) {
  let mapa = null

  /**
   * El id de bloque **NO es siempre `a<N>`** (en la Ley 9/2017 el "Artículo 10" es `a1-2`), así que
   * se resuelve por el índice y `a<N>` queda solo como último recurso — y solo si el número es un
   * entero puro: para un `6bis` produciría `a6bis`, que no existe o, peor, existe y es OTRO
   * artículo. Es la misma lógica que ya usa el verificador del Paso 1.
   */
  async function idDeBloque(numero) {
    if (mapa === null) {
      try {
        const r = await fetchImpl(`${API}/${id}/texto/indice`, { headers: { Accept: 'application/xml' } })
        mapa = r.ok ? mapaBloquesPorArticulo(await r.text()) : {}
      } catch {
        mapa = {}
      }
      if (!Object.keys(mapa).length) log('⚠️ no se pudo leer el índice del BOE — se probará con el id "a<N>"')
    }
    const enIndice = bloqueDeArticulo(mapa, String(numero))
    if (enIndice) return enIndice
    if (!/^\d+$/.test(String(numero))) return null
    return `a${numero}`
  }

  return {
    tipo: 'boe',
    async articulo(numero) {
      const bloque = await idDeBloque(numero)
      if (!bloque) return null
      let xml
      try {
        const r = await fetchImpl(`${API}/${id}/texto/bloque/${bloque}`, { headers: { Accept: 'application/xml' } })
        if (!r.ok) return null
        xml = await r.text()
      } catch {
        return null
      }
      const b = bloqueVigente(xml)
      if (!b || !b.texto) return null
      return { texto: b.texto, rubrica: b.rubrica, notaVigencia: b.notaVigencia, vigencia: b.vigencia }
    },
  }
}

module.exports = { esIdBoe, abrirFuenteBoe, API }
