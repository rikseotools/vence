const { spanishTextToNumber } = require('./spanishNumber')
const { ORDINAL_SUFFIXES } = require('./ordinalesLatinos')
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

/**
 * PÁRRAFOS EDITORIALES del BOE consolidado: no son texto del artículo, pero llegan
 * con la MISMA clase `parrafo` que el texto real, así que no se pueden filtrar por
 * clase. Se listan con nombre para que añadir una familia nueva sea una línea y se
 * vea de un vistazo qué se está podando.
 *
 * Descubiertas verificando artículos reales el 26/07/2026. La LOTC llegó a apilar
 * TRES en un mismo artículo: sin filtrarlas, 3 de sus 4 artículos daban falso
 * DIVERGE. El riesgo no es solo el ruido — alguien podría "arreglar" nuestro
 * `articles.content` metiéndole la nota, que es justo lo que no debe estar ahí.
 *
 * `vigencia` va aparte (ver `notaVigencia`): esa sí es información que puede
 * invalidar una pregunta y hay que ver, no solo descartar.
 */
const NOTAS_EDITORIALES = [
  // "Artículo 164 de la Constitución Española." — concordancia con el precepto
  // constitucional relacionado.
  { nombre: 'concordancia', re: /^Art[íi]culos?\s+[\d.,\sy]+(?:y\s+\d+)?\s+de la Constituci[óo]n(\s+Espa[ñn]ola)?\.?$/i },
  // "Apartado redactado conforme a la Ley Orgánica 6/2007…" — de dónde viene la
  // redacción vigente. Se exige el verbo CON su preposición para no pescar texto
  // real que empiece por "Apartado" o "Artículo".
  { nombre: 'redaccion', re: /^(?:Apartado|Art[íi]culos?|N[úu]meros?|Letras?|P[áa]rrafos?|Ep[íi]grafes?)\b[^.]{0,70}\bredactad[oa]s?\b[^.]{0,20}\b(?:conforme|por|seg[úu]n)\b/i },
  // "Véase, asimismo, el artículo 6.1.c) de la Ley Orgánica 5/1985…" — remisión a
  // otras normas. Singular y plural.
  { nombre: 'vease', re: /^V[ée]a(?:se|nse)\b/i },
]

/** ¿Es este párrafo una nota editorial y no texto del artículo? */
function esNotaEditorial(p) {
  return NOTAS_EDITORIALES.some(({ re }) => re.test(p))
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
  // Se recorren `<p class="…">` Y las celdas `<td>/<th>` en el MISMO barrido, para
  // conservar el orden del documento.
  //
  // POR QUÉ LAS CELDAS (26/07/2026): el BOE usa dos codificaciones distintas para las
  // tablas y las mezcla EN LA MISMA NORMA, versión a versión. Las redacciones viejas
  // envuelven el contenido de la celda en `<p class="cuerpo_tabla_izq">`; las nuevas lo
  // ponen DIRECTAMENTE en `<td class="cuerpo_tabla_izq">…</td>`, sin `<p>` dentro. Leer
  // solo los `<p>` hacía desaparecer **el cuerpo entero de la tabla** en la redacción
  // nueva, sin avisar.
  //
  // Caso real: art. 40 bis del Decreto-Legislativo 1/2009 de Canarias (Tasa fiscal sobre
  // el juego). Versiones 2012-2019 → celdas en `<p>`; versión 20220101 (la VIGENTE) →
  // celdas en `<td>`. El helper devolvía el artículo sin su escala de tipos y
  // `comparaConBd` daba **falso DIVERGE** contra un `content` que era correcto.
  //
  // Y el falso DIVERGE aquí no es solo ruido: el método de revisión manda comparar con
  // el BOE y corregir nuestro texto, así que alguien podría "arreglarlo" **borrando los
  // tipos de gravamen** — justo el dato por el que pregunta el temario.
  //
  // La rama de celda solo casa `<td>/<th>` que NO contengan `<p>` — con un match
  // "templado" (`(?!<p\b)`), no descartándola después. Si se deja que la celda case y se
  // filtra a posteriori, el match CONSUME la celda entera y los `<p>` de dentro no se
  // vuelven a visitar: se perdían las cabeceras de tabla, que sí van en `<p>`.
  const parrafos = [...sinNotas.matchAll(/<p\b[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/p>|<(?:td|th)\b([^>]*)>((?:(?!<p\b)[\s\S])*?)<\/(?:td|th)>/g)]
    .map((m) => (m[2] !== undefined
      ? { clase: m[1], html: m[2] }
      : { clase: (m[3].match(/class="([^"]*)"/) || [, ''])[1], html: m[4] }))
    .filter((x) => !/nota/.test(x.clase))
    .map((x) => decodificar(x.html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
    // OJO: los tags inline se vacían SIN espacio. Sustituirlos por un espacio parece
    // más prudente, pero el BOE escribe `<i>Hecho imponible</i>.–Constituye…` y metía
    // un espacio antes del `.–` que el texto oficial no tiene → falso DIVERGE.
    .filter(Boolean)

  // Las NOTAS DE VIGENCIA ("Téngase en cuenta que…") viajan como un párrafo más
  // dentro del cuerpo, no en el blockquote de `nota_pie`. Separarlas importa por
  // dos motivos: (1) si se dejan dentro, cualquier comparación contra nuestro
  // `articles.content` sale "DIVERGE" por una cola que no es texto del artículo;
  // (2) esa nota es justo la información que NO tenemos y que puede invalidar una
  // pregunta. Caso real (26/07/2026): art. 72 de la Ley 9/2017 — *"se declara que
  // el apartado 4 no es conforme con el orden constitucional de competencias …
  // por la Sentencia del TC 68/2021"*.
  // LA REDACCIÓN ANTERIOR VIENE DENTRO DEL BLOQUE VIGENTE (26/07/2026). El BOE intercala un
  // párrafo marcador «Redacción anterior:» y, detrás, el texto DEROGADO ENTRE COMILLAS.
  // Servirlo es el fallo que este módulo existe para evitar, y además produce un falso
  // DIVERGE contra un `content` correcto (art. 177 quinquies de la LGT: "BD 2.877 ch / BOE
  // 3.492 ch", y los 615 de diferencia eran la redacción previa a la Ley 13/2023).
  //
  // ⚠️ NO se puede cortar "todo lo que sigue al marcador", que fue el primer intento: en el
  // art. 117 de la LGT el inserto va EN MEDIO —marcador, la letra c) antigua entre comillas,
  // y el artículo CONTINÚA con d), e)… hasta n) y el apartado 2—, así que cortar dejaba el
  // artículo en 552 de sus 2.189 caracteres. Se elimina el marcador y solo el BLOQUE CITADO
  // que le sigue: desde el párrafo que abre comillas hasta el que las cierra.
  const esMarcadorRedaccion = (p) => /^Redacci[óo]n(es)? anterior(es)?\s*:?\s*$/i.test(p)
  const ABRE = /^["“«]/
  const CIERRA = /["”»]\s*$/
  const sinRedaccionAnterior = []
  for (let i = 1; i < parrafos.length; i++) {
    if (!esMarcadorRedaccion(parrafos[i])) { sinRedaccionAnterior.push(parrafos[i]); continue }
    // Saltar el marcador y, si lo que sigue abre comillas, el bloque citado completo.
    let j = i + 1
    if (j < parrafos.length && ABRE.test(parrafos[j])) {
      while (j < parrafos.length && !CIERRA.test(parrafos[j])) j++
      j++ // el que cierra las comillas también se descarta
    }
    i = j - 1
  }
  const cuerpo = sinRedaccionAnterior
  const notas = cuerpo.filter((p) => /^T[ée]ngan?se en cuenta/i.test(p))
  const texto = cuerpo
    .filter((p) => !/^T[ée]ngan?se en cuenta/i.test(p))
    .filter((p) => !esNotaEditorial(p))
    .join('\n\n')

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
 * Mapea los artículos en dígitos (`Artículo 10`), en letra (`Artículo primero`, que usan
 * las leyes antiguas) y **con sufijo** (`Artículo 40 bis`), cada uno con su propia clave
 * (`'40'` y `'40 bis'` son entradas distintas y no se pisan).
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
    // Sufijos COMPUESTOS: la LECrim numera "Artículo 588 bis b" y "Artículo 861 bis a)"
    // —ordinal + letra, con o sin paréntesis— y así los guarda `articles.article_number`.
    // Con el patrón de sufijo simple no mapeaban y sus artículos quedaban fuera de toda
    // comprobación contra el BOE (T-139, 26/07/2026).
    // Los ordinales altos y la variante ACENTUADA ("quáter") también existen: la LECrim
    // rotula "Artículo 367 quáter" y el CP llega hasta "127 octies" (T-146), y la LGT hasta
    // "177 quaterdecies" (T-045). Sin ellos en la lista, esos artículos no entraban en el
    // mapa y quedaban fuera de toda comprobación contra el BOE — en la serie 177 de la LGT
    // el verificador daba HTTP 404 en 6 de 14, que parece "el BOE no responde".
    //
    // La lista es la CANÓNICA (`lib/laws/ordinalesLatinos.js`) y NO se vuelve a escribir
    // aquí: esta misma lista se ha reescrito mal tres veces —las 4 copias divergentes de
    // `boe-extractor.ts` (T-045), la copia corta de este módulo, y su ampliación parcial en
    // T-146— y dos sesiones distintas tropezaron con ella el mismo día.
    const conSufijo = crudo.match(new RegExp(`^(\\d+)\\s+(${ORDINAL_SUFFIXES})(\\s+[a-z]\\)?)?$`, 'i'))
    const num = /^\d+$/.test(crudo)
      ? crudo
      : conSufijo
        ? `${conSufijo[1]} ${conSufijo[2].toLowerCase()}${(conSufijo[3] || '').toLowerCase()}`
        : spanishTextToNumber(crudo) || null
    if (num && !mapa[num]) mapa[num] = id
  }
  return mapa
}

/**
 * Clave canónica de un número de artículo, para poder cruzar el rótulo del BOE con
 * nuestro `articles.article_number` aunque no se escriban igual.
 *
 * POR QUÉ (T-146, 26/07/2026): el índice del BOE rotula «Artículo 6 bis» y nuestra
 * BD guarda `6bis` — **la búsqueda fallaba por un espacio**, el verificador daba
 * `HTTP 404` y, con él, **el Paso 1 del manual era imposible para toda la familia
 * de reforma** (183 artículos escopados sin una sola pregunta). Lo mismo con la
 * tilde: la BD tiene `367 quáter` y el BOE puede escribir `quater`. Caso raíz:
 * Ley 19/2013 art. 6 bis, el artículo de más alcance de la campaña (17 oposiciones,
 * 5.109 opositores), que no se podía verificar.
 */
function claveArticulo(n) {
  return String(n ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quáter → quater
    .replace(/[\s.)]/g, '') // "6 bis" → "6bis", "861 bis a)" → "861bisa"
    .trim()
}

/**
 * Busca el id de bloque de un artículo en el mapa del índice, tolerando las
 * diferencias de escritura entre el BOE y nuestra BD. Devuelve `null` si no está
 * (que es información: significa que hay que mirar el índice a mano, no inventar
 * un id `a<N>` que puede devolver OTRO artículo con apariencia de éxito).
 */
function bloqueDeArticulo(mapa, numero) {
  const m = mapa || {}
  if (m[numero]) return m[numero]
  const k = claveArticulo(numero)
  for (const [clave, id] of Object.entries(m)) if (claveArticulo(clave) === k) return id
  return null
}

/**
 * Extrae un artículo de un **DOCUMENTO** del BOE (no de legislación consolidada).
 *
 * Por qué hace falta (T-143, 26/07/2026): las normas EUROPEAS no están en
 * legislación consolidada — la API devuelve `400 Identificador no válido` para el
 * RGPD— pero sí existen como documento y se sirven en XML por
 * `https://www.boe.es/buscar/xml.php?id=DOUE-L-2016-80807`. Sin esta vía, toda la
 * legislación de la UE del temario quedaba FUERA del Paso 1 del manual (contrastar
 * el `content` contra la fuente), que es el que impide anclar preguntas a texto
 * desactualizado.
 *
 * Diferencias con el consolidado, que obligan a un parser distinto:
 *   · no hay `<version>` ni `fecha_vigencia` → no se elige versión: el documento ES
 *     el texto publicado (ojo: eso significa que NO refleja modificaciones posteriores);
 *   · es un documento plano: los artículos se delimitan por los marcadores
 *     `<p class="articulo">`, y el cuerpo son los `parrafo`/`parrafo_2` siguientes
 *     hasta el próximo marcador;
 *   · los títulos vienen con espacio duro y espacio em ("Artículo\u00a038.\u2003Posición…").
 *
 * @param {string} xml Respuesta de `/buscar/xml.php?id=<DOUE-…>`.
 * @param {string|number} numero Número de artículo.
 * @returns {{rubrica:string, texto:string}|null}
 */
function articuloDeDocumento(xml, numero) {
  const ps = [...String(xml || '').matchAll(/<p class="([^"]*)"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => ({
    clase: m[1],
    txt: normalizar(decodificar(m[2].replace(/<[^>]+>/g, ''))),
  }))
  // Un marcador de artículo puede venir de DOS formas, y hay que soportar las dos:
  //   · `<p class="articulo">` — es el caso del RGPD (DOUE-L-2016-80807);
  //   · un `parrafo` cuyo texto ENTERO es "Artículo N" — es el caso del documento
  //     de los Tratados (DOUE-Z-2010-70002), que no usa la clase `articulo` en
  //     absoluto: sus 989 KB son todos `parrafo` y el encabezado va suelto.
  // Sin la segunda forma, el TFUE daba "artículo no encontrado" y quedaba sin
  // verificar (T-143, 26/07/2026).
  const esMarcador = (p) => p.clase === 'articulo' || (/^parrafo/.test(p.clase) && /^Art[íi]culo\s+\S{1,12}\.?$/i.test(p.txt))
  const re = new RegExp(`^Art[íi]culo\\s+${String(numero).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  const i = ps.findIndex((p) => esMarcador(p) && re.test(p.txt))
  if (i < 0) return null

  const cuerpo = []
  for (let j = i + 1; j < ps.length && !esMarcador(ps[j]); j++) {
    if (!/^parrafo/.test(ps[j].clase)) continue // tablas, citas y secciones fuera
    if (esNotaEditorial(ps[j].txt)) continue
    cuerpo.push(ps[j].txt)
  }
  return { rubrica: ps[i].txt, texto: cuerpo.join('\n\n') }
}

module.exports = { bloqueVigente, comparaConBd, mapaBloquesPorArticulo, bloqueDeArticulo, claveArticulo, articuloDeDocumento, esNotaEditorial, NOTAS_EDITORIALES, decodificar, normalizar }
