// lib/laws/eurlexConsolidado.js — extracción PURA de un artículo del texto CONSOLIDADO de EUR-Lex.
// Sin red, sin BD: recibe el HTML y devuelve el texto. Hermano de `boeBloqueVigente.js`, que hace
// lo propio con el BOE consolidado.
//
// ## Por qué hace falta (T-184, 27/07/2026) — y por qué el BOE NO sirve para esto
//
// Para una norma de la UE, el espejo del BOE (`DOUE-…`) reproduce el **texto ORIGINAL publicado en
// el DOUE, con sus erratas**, y no incorpora las correcciones de errores posteriores. El RGPD tuvo
// una (DO L 127, 23/05/2018), así que comparar contra el BOE da un veredicto AL REVÉS:
//
//   · BOE / DOUE original : «…o datos relativos a la vida sexual o LAS ORIENTACIÓN SEXUALES de una
//                            persona física» ← concordancia rota, es la errata.
//   · EUR-Lex consolidada : «…o LA ORIENTACIÓN SEXUAL de una persona física» ← lo vigente.
//
// Medido ese día sobre `rgpd-ue-2016-679`: contra el BOE "divergían" 80 de 99 artículos. Reescribir
// el `content` con ese veredicto habría METIDO erratas en el texto que leen 49 oposiciones. De ahí
// que el verificador acepte ahora un id `CELEX:` y venga a parar aquí.
//
// ## Las TRES trampas de parseo (las tres se cometieron antes de acertar)
//
// 1. **La rúbrica va dentro del bloque.** EUR-Lex abre cada artículo con «Artículo N» + su título;
//    en nuestra BD eso vive en `articles.title`, no en `content`. Sin podarlo, los 99 artículos
//    "divergen" por ~60 chars y la primera medición dio **0 de 99** coincidencias.
// 2. **El troceo arrastra una etiqueta a medio cerrar.** Cortar en el índice del `id="art_N+1"` deja
//    un `<div class="eli-subdivision` sin `>` que el `strip` de etiquetas no borra (su regex exige
//    el cierre) → +29 chars fantasma en TODOS los artículos.
// 3. **`n.<sup>o</sup>` se convierte en `n. o`** si se quitan las etiquetas sin desenvolver antes
//    los `<sup>`, y aparece una divergencia donde no la hay.
//
// Además hay que borrar las **marcas de consolidación** (`▼B`, `▼M1`, `►C1`…), que EUR-Lex intercala
// para señalar de qué acto viene cada trozo y no son texto de la norma.

/** Marcas de consolidación de EUR-Lex: ▼B (acto base), ▼M1 (modificación 1), ►C1 (corrección)… */
const MARCAS_CONSOLIDACION = /[▼►][BMC]\d*/g

// El encabezado del artículo en EUR-Lex son DOS elementos con clase propia: el «Artículo N»
// (`title-article-norm`) y la rúbrica (`stitle-article-norm`). Se podan por su MARCA y no
// comparando con nuestro `articles.title`, que es lo que se hacía antes.
//
// POR QUÉ (T-193, 28/07/2026). La poda por cadena solo quitaba la rúbrica si nuestro título
// EMPEZABA igual que el oficial. En el art. 73 del RGPD guardamos «Presidente» y EUR-Lex rotula
// «Presidencia»: no casaba, y la rúbrica se colaba como primera línea del cuerpo. Justo la ley que
// hay que reimportar es aquella en la que los títulos también están parafraseados, así que la poda
// fallaba precisamente donde más falta hacía. La marca del HTML no depende de lo que tengamos.
const RE_TITULO_ARTICULO = /<p[^>]*class="[^"]*\btitle-article-norm\b[^"]*"[^>]*>[\s\S]*?<\/p>/gi
const RE_RUBRICA_ARTICULO = /<p[^>]*class="[^"]*\bstitle-article-norm\b[^"]*"[^>]*>[\s\S]*?<\/p>/gi

/** Convierte un fragmento de HTML de EUR-Lex en texto plano comparable. */
function limpiar(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // (3) desenvolver ANTES de quitar etiquetas: `n.<sup>o</sup>` → `n.o`, no `n. o`.
    // EUR-Lex NO usa <sup>: usa `<span class="superscript">o</span>` (comprobado en el HTML real
    // del RGPD, 27/07). Se soportan las dos formas — dar por hecha la primera me costó una
    // divergencia falsa en el art. 2.
    .replace(/<sup>([^<]*)<\/sup>/gi, '$1')
    .replace(/<span class="superscript">([^<]*)<\/span>/gi, '$1')
    // (2) etiqueta a medio cerrar que deja el troceo por índice
    .replace(/<[^>]*$/, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&[a-zA-Z]+;/g, ' ')
    .replace(MARCAS_CONSOLIDACION, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Texto del artículo `numero` en el HTML consolidado de EUR-Lex.
 *
 * @param {string} html    documento completo (`legal-content/ES/TXT/HTML/?uri=CELEX:0…`)
 * @param {number|string} numero
 * @param {string} [rubrica]  título del artículo (`articles.title`); si se pasa, se poda del texto
 *   para que la comparación sea contra el CUERPO, igual que guarda la BD.
 * @returns {{rubrica: string|null, texto: string}|null} `null` si el artículo no está.
 */
function articuloDeEurLex(html, numero, rubrica) {
  const bruto = recorteArticulo(html, numero)   // MISMO recorte que la vía por párrafos
  if (bruto == null) return null
  const rubricaOficial = rubricaDeBloque(bruto)

  let texto = limpiar(quitarEncabezado(bruto))
    .replace(/^id="art_\d+">?\s*/, '')
    // (1) la rúbrica: primero el «Artículo N»…
    .replace(/^Art[íi]culo\s*\d+\s*/i, '')
    .trim()

  const cabecera = texto.slice(0, 200)
  // …y después el título, si lo conocemos y está donde debe (al principio).
  if (rubrica && String(rubrica).trim()) {
    const t = String(rubrica).trim()
    if (texto.toLowerCase().startsWith(t.toLowerCase())) texto = texto.slice(t.length).trim()
  }

  return { rubrica: rubricaOficial || cabecera.split(/\s(?=\d+\.\s)/)[0] || null, texto }
}

/**
 * ¿Es este id una referencia a EUR-Lex? Acepta `CELEX:02016R0679-20160504` y el CELEX pelado.
 * El `0` inicial del CELEX marca el texto CONSOLIDADO; `3…` es el acto original (con erratas).
 */
function esIdEurLex(id) {
  return /^(CELEX:)?[0-9]{5}[A-Z][0-9]{4}(-\d{8})?$/i.test(String(id || '').trim())
}

/** ¿El CELEX apunta al acto ORIGINAL en vez de al consolidado? (sector 3 = acto publicado) */
function esCelexNoConsolidado(id) {
  return /^(CELEX:)?3/i.test(String(id || '').trim())
}

/** URL del documento HTML en EUR-Lex para un id CELEX. */
function urlEurLex(id) {
  const celex = String(id).trim().replace(/^CELEX:/i, '')
  return `https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:${celex}`
}

/**
 * URL del MISMO documento en Cellar, el repositorio del Publications Office.
 *
 * Hace falta porque EUR-Lex está detrás de CloudFront y, cuando nos limita, responde
 * **`202 Accepted` con el cuerpo VACÍO** en vez de un 429. Medido el 28/07/2026: cinco
 * intentos seguidos con reintento y espera creciente, y Playwright con navegador real,
 * todos 202 y 0 bytes — no es el fingerprint, es cuota. Cellar sirvió el mismo documento
 * (494 KB) en la misma sesión. Requiere `Accept-Language: spa` o devuelve otra lengua.
 */
function urlCellar(id) {
  const celex = String(id).trim().replace(/^CELEX:/i, '')
  return `http://publications.europa.eu/resource/celex/${celex}`
}

/** Fuentes del documento en orden de preferencia: EUR-Lex y, si nos limita, su espejo Cellar. */
function fuentesDocumento(id) {
  return [
    { url: urlEurLex(id), nombre: 'EUR-Lex' },
    { url: urlCellar(id), nombre: 'Cellar', cabeceras: { Accept: 'text/html;q=1.0, application/xhtml+xml', 'Accept-Language': 'spa' } },
  ]
}

/**
 * ¿Este HTML es el documento de verdad, o una respuesta de cortesía del WAF?
 *
 * EL PORQUÉ, que costó una medición entera: un `202` **pasa el filtro `r.ok`** (que es
 * `200-299`), así que el cuerpo vacío se colaba, `parrafosDeEurLex` devolvía `null` para
 * TODOS los artículos y el script informaba tan tranquilo de que no había nada que
 * reescribir. Un falso negativo silencioso: el peor resultado posible, porque parece un
 * veredicto. Por eso se valida el CONTENIDO, no el código de estado.
 *
 * @returns {{sirve:boolean, motivo:string}}
 */
function documentoSirve(html) {
  const h = String(html || '')
  if (h.length < 5000) return { sirve: false, motivo: `cuerpo de ${h.length} bytes: respuesta vacía o de cortesía, no el documento` }
  if (!/id="art_\d+"/.test(h)) return { sirve: false, motivo: 'el HTML no trae ningún artículo (id="art_N"): ¿página de aviso o de selección de lengua?' }
  return { sirve: true, motivo: 'documento con artículos' }
}

/**
 * Igual que `articuloDeEurLex`, pero conservando la ESTRUCTURA en párrafos.
 *
 * Por qué hace falta: `articles.content` guarda un salto de línea por apartado y por letra
 * («1. Los datos personales serán:\na) tratados…\nb) recogidos…»), y la teoría que lee el opositor
 * se renderiza con eso. Volcar el texto aplanado arreglaría la literalidad y ROMPERÍA la
 * presentación — un arreglo que estropea otra cosa no es un arreglo.
 *
 * EUR-Lex marca los apartados con `<span class="no-parag">N.</span>` y las letras con
 * `<div class="grid-container grid-list">` + `<span>a) </span>`. Se inserta un separador antes de
 * cada uno y se limpia por segmentos.
 */
function parrafosDeEurLex(html, numero, rubrica) {
  const bruto = recorteArticulo(html, numero)
  if (bruto == null) return null
  const SEP = '\u0001'
  const marcado = quitarEncabezado(bruto)
    .replace(/<span class="no-parag">/gi, SEP + '<span class="no-parag">')
    .replace(/<div class="grid-container grid-list">/gi, SEP + '<div class="grid-container grid-list">')
  const segmentos = marcado.split(SEP).map((x) => limpiar(x)).filter(Boolean)
  // El primer segmento arrastra «Artículo N» + rúbrica (o es el cuerpo si el artículo no tiene
  // apartados numerados): se poda igual que en `articuloDeEurLex`.
  if (segmentos.length) {
    segmentos[0] = podarCabecera(segmentos[0], numero, rubrica)
    if (!segmentos[0]) segmentos.shift()
  }
  return { texto: segmentos.join('\n') }
}

/**
 * Recorte crudo del bloque del artículo (sin limpiar), o null si no está.
 *
 * El bloque termina en el siguiente artículo **o en el siguiente encabezado de división**
 * (`id="cpt_IV.sct_2"`, `id="cpt_V"`…). Sin lo segundo, un artículo que cierra sección se lleva
 * pegado el título de la que empieza: el art. 31 del RGPD acababa en «…en el desempeño de sus
 * funciones. Sección 2 Seguridad de los datos personales». Es contaminación METIDA POR NOSOTROS,
 * y se detectó mirando a ojo el texto que se iba a escribir, no con un contador.
 */
function recorteArticulo(html, numero) {
  const src = String(html || '')
  const n = String(numero)
  const marca = `id="art_${n}"`
  const i = src.indexOf(marca)
  if (i < 0) return null
  let fin = src.length
  // Artículo siguiente…
  const reArt = /id="art_(\d+)"/g
  reArt.lastIndex = i + marca.length
  let m
  while ((m = reArt.exec(src))) { if (m[1] !== n) { fin = m.index; break } }
  // …o encabezado de división (capítulo/sección) si llega antes.
  const reDiv = /id="(?:cpt|sct|tit|pt)_[^"]*"/g
  reDiv.lastIndex = i + marca.length
  const d = reDiv.exec(src)
  if (d && d.index < fin) fin = d.index
  return src.slice(i, fin)
}

/** La rúbrica OFICIAL del artículo, leída de su marca en el HTML (no de nuestro `title`). */
function rubricaDeBloque(bruto) {
  const m = String(bruto || '').match(/<p[^>]*class="[^"]*\bstitle-article-norm\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
  return m ? limpiar(m[1]) || null : null
}

/** Quita del bloque CRUDO el «Artículo N» y la rúbrica, por su marca en el HTML. */
function quitarEncabezado(bruto) {
  return String(bruto || '').replace(RE_TITULO_ARTICULO, ' ').replace(RE_RUBRICA_ARTICULO, ' ')
}

/** Quita «id="art_N">», «Artículo N» y la rúbrica del principio de un texto ya limpio. */
function podarCabecera(texto, numero, rubrica) {
  let t = String(texto || '')
    .replace(/^id="art_\d+">?\s*/, '')
    .replace(/^Art[íi]culo\s*\d+\s*/i, '')
    .trim()
  if (rubrica && String(rubrica).trim()) {
    const r = String(rubrica).trim()
    if (t.toLowerCase().startsWith(r.toLowerCase())) t = t.slice(r.length).trim()
  }
  return t
}

module.exports = {
  articuloDeEurLex,
  parrafosDeEurLex,
  esIdEurLex,
  esCelexNoConsolidado,
  urlEurLex,
  urlCellar,
  fuentesDocumento,
  documentoSirve,
  limpiar,
  MARCAS_CONSOLIDACION,
}
