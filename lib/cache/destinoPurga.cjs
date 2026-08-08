// lib/cache/destinoPurga.cjs
//
// ¿A qué sitio va a mandar sus POST una herramienta de purga de caché?
//
// POR QUÉ EXISTE (medido, 08/08/2026):
// `scripts/purge-all-cache.js` lee `process.env.SITE_URL` con fallback a producción.
// En cualquier máquina de desarrollo `.env.local` trae `SITE_URL=http://localhost:3000`
// —que es lo CORRECTO para el resto del proyecto—, así que la herramienta apuntaba a
// localhost y la purga no llegaba nunca a producción. Se detectó al purgar tras el
// re-anclaje de [T-683]: **0 OK de 1.760 rutas**, sin que el resumen dijera a dónde
// estaba llamando.
//
// Y EL FALLO GRAVE NO ES EL QUE SE VIO: con `npm run dev` levantado en el puerto 3000
// las 1.760 llamadas responden 200 y el resumen canta «1.760 OK» — purga la caché del
// portátil y deja producción intacta. Un verde por apuntar al sitio equivocado es peor
// que un rojo: nadie vuelve a mirar.
//
// CRITERIO: fallar CERRADO. Si el destino no es producción, la herramienta se niega a
// correr salvo que quien la lanza lo diga a propósito (`--local`). Nunca se corrige el
// destino por su cuenta: pisar en silencio una variable que el operador puso es la otra
// forma de la misma mentira.

const PRODUCCION = 'https://www.vence.es'

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

/**
 * Clasifica el destino de una purga.
 * @param {string|undefined|null} url  valor de SITE_URL (o el que use la herramienta)
 * @returns {{destino: string, esProduccion: boolean, esLocal: boolean, motivo: string|null}}
 */
function clasificarDestinoPurga(url) {
  const destino = (url || '').trim() || PRODUCCION

  let host
  try {
    host = new URL(destino).hostname
  } catch {
    return {
      destino,
      esProduccion: false,
      esLocal: false,
      motivo: `«${destino}» no es una URL válida`,
    }
  }

  const esLocal = HOSTS_LOCALES.has(host) || host.endsWith('.local')
  const esProduccion = host === 'www.vence.es' || host === 'vence.es'

  if (esLocal) return { destino, esProduccion: false, esLocal: true, motivo: `apunta a tu máquina (${host})` }
  if (!esProduccion) return { destino, esProduccion: false, esLocal: false, motivo: `${host} no es producción` }
  return { destino, esProduccion: true, esLocal: false, motivo: null }
}

/**
 * ¿Puede correr la purga contra este destino?
 * @param {string|undefined|null} url
 * @param {{permitirNoProduccion?: boolean}} [opciones]  `--local` explícito de quien lanza
 */
function puedePurgar(url, opciones = {}) {
  const c = clasificarDestinoPurga(url)
  if (c.esProduccion) return { ok: true, ...c }
  if (opciones.permitirNoProduccion) return { ok: true, ...c }
  return { ok: false, ...c }
}

module.exports = { clasificarDestinoPurga, puedePurgar, PRODUCCION }
