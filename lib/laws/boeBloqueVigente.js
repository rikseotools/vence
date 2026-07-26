const { spanishTextToNumber } = require('./spanishNumber')
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

  // Las NOTAS DE VIGENCIA ("Téngase en cuenta que…") viajan como un párrafo más
  // dentro del cuerpo, no en el blockquote de `nota_pie`. Separarlas importa por
  // dos motivos: (1) si se dejan dentro, cualquier comparación contra nuestro
  // `articles.content` sale "DIVERGE" por una cola que no es texto del artículo;
  // (2) esa nota es justo la información que NO tenemos y que puede invalidar una
  // pregunta. Caso real (26/07/2026): art. 72 de la Ley 9/2017 — *"se declara que
  // el apartado 4 no es conforme con el orden constitucional de competencias …
  // por la Sentencia del TC 68/2021"*.
  const cuerpo = parrafos.slice(1)
  const notas = cuerpo.filter((p) => /^T[ée]ngase en cuenta/i.test(p))
  const texto = cuerpo.filter((p) => !/^T[ée]ngase en cuenta/i.test(p)).join('\n\n')

  return {
    rubrica: parrafos[0] || '',
    texto,
    notaVigencia: notas.join('\n\n') || null,
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
  if (!b) return { coincide: false, vigencia: null, lenBoe: 0, lenBd: normalizar(contenidoBd).length, divergeEn: 0, notaVigencia: null }
  const boe = normalizar(b.texto)
  const bd = normalizar(contenidoBd)
  const base = { vigencia: b.vigencia, lenBoe: boe.length, lenBd: bd.length, notaVigencia: b.notaVigencia }
  if (boe === bd) return { ...base, coincide: true, divergeEn: null }
  let i = 0
  while (i < Math.min(boe.length, bd.length) && boe[i] === bd[i]) i++
  return { ...base, coincide: false, divergeEn: i }
}

/**
 * Mapa `nº de artículo → id de bloque` a partir del índice de la norma
 * (`…/texto/indice`).
 *
 * SEGUNDO GOTCHA (26/07/2026): el id de bloque **no es siempre `a<N>`**. En la
 * Ley 9/2017 el "Artículo 10" es el bloque `a1-2` y el "Artículo 28" es `a2-10`
 * (la numeración de bloques se desordena cuando la norma ha sufrido
 * adiciones/derogaciones). Pedir `a10` devuelve **404**… y en otra norma podría
 * devolver un artículo DISTINTO con apariencia de éxito, que es el fallo
 * peligroso: compararías tu `content` contra el texto de otro precepto.
 *
 * Solo mapea artículos "limpios" (`Artículo 10`), no los `bis`/`ter`, que se
 * indexan aparte y hay que pedir por su propio id.
 *
 * @param {string} indiceXml Respuesta cruda de `…/texto/indice`.
 * @returns {Record<string,string>} p.ej. `{ '10': 'a1-2', '28': 'a2-10' }`
 */
function mapaBloquesPorArticulo(indiceXml) {
  const mapa = {}
  const bloques = [...String(indiceXml || '').matchAll(/<bloque>\s*<id>([^<]*)<\/id>\s*<titulo>([\s\S]*?)<\/titulo>/g)]
  for (const m of bloques) {
    const id = m[1].trim()
    const titulo = decodificar(m[2].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
    // OJO: no todas las leyes numeran en dígitos. Las ANTIGUAS lo hacen en letra
    // ("Artículo primero", "Artículo setecientos trece"): en la LOPJ son 713 de 713.
    // Con el match solo-dígitos, esas leyes quedaban ENTERAS fuera de la auditoría y el
    // barrido decía "0 hallazgos" sin haber mirado nada (T-132, 26/07/2026).
    // Y tampoco todas escriben "Artículo": el Código Civil (1889) rotula sus 2.028
    // bloques como "Art 1", abreviado y sin punto. Con el prefijo largo obligatorio, la
    // ley entera quedaba invisible (T-133). Se exige espacio tras "Art" para no casar con
    // palabras que empiezan igual ("Artes y oficios").
    const art = titulo.match(/^Art(?:[íi]culo)?\.?\s+(.+?)\s*\.?$/i)
    if (!art) continue
    // Tres formas conviven en el corpus: "45", "45 bis" (dígitos + sufijo) y
    // "cuarenta y cinco" (letra). La segunda se perdía: no es dígito puro y
    // `spanishTextToNumber` no convierte una parte ya numérica (T-133).
    const crudo = art[1].trim()
    const conSufijo = crudo.match(/^(\d+)\s+(bis|ter|quater|quinquies|sexies|septies)$/i)
    const num = /^\d+$/.test(crudo)
      ? crudo
      : conSufijo
        ? `${conSufijo[1]} ${conSufijo[2].toLowerCase()}`
        : spanishTextToNumber(crudo) || null
    if (num && !mapa[num]) mapa[num] = id
  }
  return mapa
}

module.exports = { bloqueVigente, comparaConBd, mapaBloquesPorArticulo, decodificar, normalizar }
