/**
 * Extracción del texto VIGENTE de un bloque (artículo) del BOE consolidado.
 *
 * GOTCHA que motiva este módulo (26/07/2026, campaña T-115): la respuesta de
 * `…/legislacion-consolidada/id/<BOE-ID>/texto/bloque/a<N>` trae UNA `<version>`
 * por cada redacción histórica del precepto, y **NO vienen en orden cronológico**.
 * En el art. 2 de la Ley 7/1985 el orden es 1985 → 2013 → 1990: quedarse con la
 * última (`versiones[versiones.length-1]`) devuelve la redacción de 1990, es decir
 * texto DEROGADO, y una pregunta anclada a él enseña Derecho que ya no está en
 * vigor. Hay que elegir SIEMPRE por `fecha_vigencia`, nunca por posición.
 *
 * Segundo detalle: dentro de cada `<version>` el BOE mete las notas de
 * modificación en `<blockquote><p class="nota_pie">…`. Si no se podan, el texto
 * "oficial" acaba con una cola de "Se modifica por la disposición final 1 de la
 * Ley 35/2014…" que no es parte del artículo y rompe cualquier comparación
 * literal contra `articles.content`.
 */

const ENTIDADES = {
  '&aacute;': 'á', '&eacute;': 'é', '&iacute;': 'í', '&oacute;': 'ó', '&uacute;': 'ú',
  '&Aacute;': 'Á', '&Eacute;': 'É', '&Iacute;': 'Í', '&Oacute;': 'Ó', '&Uacute;': 'Ú',
  '&ntilde;': 'ñ', '&Ntilde;': 'Ñ', '&uuml;': 'ü', '&Uuml;': 'Ü',
  '&laquo;': '«', '&raquo;': '»', '&quot;': '"', '&nbsp;': ' ',
  '&ordf;': 'ª', '&ordm;': 'º', '&deg;': '°', '&iexcl;': '¡', '&iquest;': '¿',
  '&amp;': '&',
}

/** Decodifica las entidades HTML que usa el BOE (incluidas las numéricas). */
function decodificar(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&[a-zA-Z]+;/g, (m) => (ENTIDADES[m] !== undefined ? ENTIDADES[m] : m))
}

/** Normaliza espacios y comillas tipográficas para comparar dos textos. */
function normalizar(s) {
  return String(s || '').replace(/\s+/g, ' ').replace(/[“”]/g, '"').trim()
}

/**
 * Devuelve el texto vigente de un bloque a partir del XML del BOE.
 *
 * @param {string} xml Respuesta cruda de la API (Accept: application/xml).
 * @returns {{rubrica:string, texto:string, vigencia:string, nVersiones:number}|null}
 *   `null` si el bloque no trae ninguna `<version>` (artículo inexistente o error).
 */
function bloqueVigente(xml) {
  const versiones = [...String(xml || '').matchAll(/<version\b([^>]*)>([\s\S]*?)<\/version>/g)].map((m) => ({
    vigencia: (m[1].match(/fecha_vigencia="(\d{8})"/) || [, '00000000'])[1],
    cuerpo: m[2],
  }))
  if (!versiones.length) return null

  // Por fecha_vigencia, NUNCA por posición en el documento (ver cabecera).
  const v = versiones.reduce((a, b) => (b.vigencia > a.vigencia ? b : a))

  const sinNotas = v.cuerpo.replace(/<blockquote>[\s\S]*?<\/blockquote>/g, '')
  const parrafos = [...sinNotas.matchAll(/<p\b[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/p>/g)]
    .filter((m) => !/nota/.test(m[1]))
    .map((m) => decodificar(m[2].replace(/<[^>]+>/g, '')).trim())
    .filter(Boolean)

  return {
    rubrica: parrafos[0] || '',
    texto: parrafos.slice(1).join('\n\n'),
    vigencia: v.vigencia,
    nVersiones: versiones.length,
  }
}

/**
 * ¿Coincide el `content` que tenemos en BD con el texto vigente del BOE?
 * Compara ignorando diferencias de espaciado y de comillas tipográficas.
 *
 * @returns {{coincide:boolean, vigencia:string|null, lenBoe:number, lenBd:number, divergeEn:number|null}}
 */
function comparaConBd(xml, contenidoBd) {
  const b = bloqueVigente(xml)
  if (!b) return { coincide: false, vigencia: null, lenBoe: 0, lenBd: normalizar(contenidoBd).length, divergeEn: 0 }
  const boe = normalizar(b.texto)
  const bd = normalizar(contenidoBd)
  if (boe === bd) return { coincide: true, vigencia: b.vigencia, lenBoe: boe.length, lenBd: bd.length, divergeEn: null }
  let i = 0
  while (i < Math.min(boe.length, bd.length) && boe[i] === bd[i]) i++
  return { coincide: false, vigencia: b.vigencia, lenBoe: boe.length, lenBd: bd.length, divergeEn: i }
}

module.exports = { bloqueVigente, comparaConBd, decodificar, normalizar }
