// backend/src/detect-boletines/boletines.ts
//
// Adaptadores de BOLETINES OFICIALES para el sensor `detect-boletines`.
//
// CONTEXTO (17/06/2026): el scraper regional `detect-regional-oeps` (que leía
// las webs institucionales de `detection_sources`) se retiró el 01/06/2026 por
// alto ruido, y dejó sin vigilancia el descubrimiento de convocatorias nuevas
// de cuerpos fuera de catálogo. Caso real: la Escala Administrativa (C1) de la
// Universidad de León se publicó en el BOCYL el 17/06/2026 y NO se detectó —
// porque las webs de universidades son JS y porque no había fuente para ellas.
//
// Este sensor ataca el problema por la fuente FIABLE: el SUMARIO del boletín
// oficial, que es HTML estático (BOCYL, BOJA, BOCM…) o API (BOE) — sin navegador.
// Cada adaptador devuelve, para una fecha, un texto PRE-FILTRADO de candidatos
// de convocatoria que luego afina el filtro LLM (`extractRegionalOeps`).
//
// Funciones PURAS (salvo la llamada `fetch`): testeables con la fixture de HTML.

/**
 * Una disposición candidata CON su enlace al anuncio concreto.
 *
 * NACE DEL HUECO DE PROVENANCE (28/07/2026, T-221): el sumario del boletín se
 * convertía a texto plano ANTES de trocearlo, así que el enlace de cada anuncio
 * se perdía y la señal solo se quedaba con la URL del SUMARIO DEL DÍA. Resultado
 * medido: de 133 señales aplicadas en 7 días, **19 con documento clonado (14%)** —
 * y las 110 restantes apuntaban a un sumario o a una página de listado, que es
 * justo lo que NO se puede clonar como prueba (clonar el sumario entero del BORM
 * son 739.029 caracteres que "respaldan" cualquier cifra: antipatrón T-147(c)).
 *
 * El enlace viaja PEGADO al candidato desde el parseo, nunca lo elige el LLM:
 * así no hay URL inventada posible.
 */
export interface CandidatoSumario {
  /** Título de la disposición, ya recortado y sin marcas internas. */
  titulo: string
  /** URL absoluta del anuncio concreto, o null si el boletín no la expone (p.ej. sumario en PDF). */
  url: string | null
}

export interface BoletinHit {
  /** URL del sumario consultado (para trazabilidad en la señal). */
  url: string
  /** Texto pre-filtrado: una línea por disposición candidata a convocatoria C1/C2. */
  candidatesText: string
  /**
   * Mismos candidatos que `candidatesText`, en el mismo orden, pero con el enlace
   * al anuncio concreto cuando el boletín lo expone. `candidatesText` se mantiene
   * (lo consume el prompt del LLM) y esto es ADITIVO: quien no lo mire, sigue igual.
   */
  candidatos: CandidatoSumario[]
  /**
   * Texto pre-filtrado: una línea por disposición candidata a MODIFICACIÓN DE
   * TEMARIO/PROGRAMA (Ordenes de programas exigibles / materias). Se extrae del
   * MISMO sumario ya descargado, sin fetch extra. Alimenta el sensor
   * `temario_change` (cierra el gap del caso Cantabria PRE/12/2026).
   */
  temarioText: string
}

export interface BoletinAdapter {
  key: string
  regionName: string
  /** sensor_type para la señal — debe estar en el CHECK de oep_detection_signals. */
  sensorType: 'regional_scan' | 'boe_api'
  /**
   * `true` si el boletín NO expone el sumario por fecha (solo "boletín vigente"):
   * el sumario es el mismo para cualquier `date`. El servicio lo escanea UNA sola
   * vez por pasada (no por cada día de la ventana) y confía en el dedup por norma.
   * Patrón "leer lo último + dedup" (igual que bonAdapter en el radar).
   */
  dateless?: boolean
  /** Devuelve candidatos (convocatoria + temario) para esa fecha, o null si no hay boletín. */
  scan(date: Date): Promise<BoletinHit | null>
}

// --- Heurística compartida de pre-filtrado (la limpieza fina la hace el LLM) ---

// Contexto de un proceso selectivo de INGRESO de CUALQUIER cuerpo/grupo.
// Fase 0 "catalogar TODO" (04/07/2026): ya NO se excluye por grupo (A1/A2/B
// entran igual). NOISE_RE solo descarta lo que NO es una convocatoria de
// ingreso (hitos de proceso, laboral, libre designación), nunca por grupo.
const INGRESO_RE = /(proceso selectivo|pruebas selectivas|proceso de selecci[oó]n|concurso-oposici[oó]n|\boposici[oó]n|bolsa de empleo)/i
// Cosas que NUNCA son una convocatoria de ingreso (hitos de proceso, no-oposición).
// OJO: no filtrar por grupo — catedr/cuerpo superior/profesor/subgrupo a1|a2 SE ADMITEN.
const NOISE_RE = /(relaci[oó]n de aspirantes|lista de admitidos|lista provisional|lista definitiva|han superado|nombramiento|adjudicaci[oó]n de plazas|apartamentos|v[ií]as pecuarias|personal laboral|libre designaci[oó]n)/i

/** ¿Esta línea/disposición huele a convocatoria de ingreso C1/C2 (de cualquier cuerpo)? */
export function looksLikeC1C2Convocatoria(text: string): boolean {
  return INGRESO_RE.test(text) && !NOISE_RE.test(text)
}

// --- Heurística de MODIFICACIÓN DE TEMARIO / PROGRAMA (sensor temario_change) ---
//
// Ancla robusta: las Ordenes que definen o modifican el temario de un cuerpo
// hablan de "programas exigibles" / "programa de materias" / "temario". Ej. real
// que se nos escapó: Orden PRE/12/2026 "…por la que se modifica la Orden PRE/76/2024
// …por la que se hacen públicos los PROGRAMAS EXIGIBLES en los procesos selectivos…".
// El pre-filtro es amplio a propósito (recall); el LLM (extractTemarioChanges) afina.
const PROGRAMA_RE =
  /(programas?\s+exigibles|programas?\s+de\s+materias|materias\s+exigibles|relaci[oó]n\s+de\s+materias|cuestionario\s+de\s+materias|temario\s+(?:de|para|del|exigible)|programa\s+de\s+la\s+(?:fase|oposici[oó]n))/i
// Descarta lo que menciona "programa" pero NO es temario de oposición (ej. programas
// de subvenciones/ayudas/formación no reglada).
const PROGRAMA_NOISE_RE =
  /(programa\s+de\s+(?:ayudas|subvenciones|fomento|desarrollo\s+rural|cooperaci[oó]n|inversiones))/i

/** ¿Esta disposición huele a aprobación/modificación del TEMARIO/PROGRAMA de un cuerpo? */
export function looksLikeTemarioChange(text: string): boolean {
  return PROGRAMA_RE.test(text) && !PROGRAMA_NOISE_RE.test(text)
}

/**
 * Extrae de un sumario en texto las disposiciones candidatas a MODIFICACIÓN DE
 * TEMARIO/PROGRAMA. PURA: testeable con fixture. Misma mecánica que
 * extractCandidatesFromSumarioText pero con la heurística de temario.
 */
export function extractTemarioCandidatesFromSumarioText(text: string, maxPerDay = 20): string[] {
  const parts = text.split(DISPOSICION_SPLIT_RE)
  const hits: string[] = []
  for (const p of parts) {
    if (looksLikeTemarioChange(p)) {
      const title = p.slice(0, 300).replace(/\s+(BOCYL|BOE|BOJA|BOCM|BOC)-.*$/i, '').trim()
      if (title) hits.push(title)
    }
    if (hits.length >= maxPerDay) break
  }
  return hits
}

/**
 * Casa el nombre que devuelve el LLM con el candidato del sumario del que salió, para
 * poder pegarle SU enlace. Devuelve la URL solo si el casado es INEQUÍVOCO.
 *
 * Por qué no se lo preguntamos al LLM: una URL inventada (o la de la convocatoria de al
 * lado) se convertiría en el documento que "prueba" el dato — una prueba falsa es peor
 * que no tener prueba. Aquí el modelo no elige nada: la URL viene del parseo y esto solo
 * decide a cuál de los candidatos corresponde. Ante duda (empate o parecido flojo) → null.
 *
 * PURA.
 */
export function urlDelCandidato(
  nombreExtraido: string,
  candidatos: CandidatoSumario[],
): string | null {
  const tokens = tokensSignificativos(nombreExtraido)
  if (tokens.length === 0 || candidatos.length === 0) return null

  const puntuados = candidatos.map((c) => {
    const enTitulo = new Set(tokensSignificativos(c.titulo))
    const aciertos = tokens.filter((t) => enTitulo.has(t)).length
    return { c, score: aciertos / tokens.length }
  })
  const orden = [...puntuados].sort((a, b) => b.score - a.score)
  const mejor = orden[0]
  const segundo = orden[1]
  // Umbral de parecido + desempate obligatorio: dos convocatorias del mismo cuerpo que
  // solo cambian en el turno puntúan casi igual, y ahí NO se puede adjudicar documento.
  if (mejor.score < 0.6) return null
  if (segundo && segundo.score === mejor.score) return null
  return mejor.c.url ?? null
}

function tokensSignificativos(s: string): string[] {
  return [
    ...new Set(
      (s ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 5),
    ),
  ]
}

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Resuelve un `href` (relativo o absoluto) contra la URL del sumario. Devuelve null
 * para lo que no es un documento enlazable (anclas internas, javascript:, mailto:).
 * PURA.
 */
export function absolutizarUrl(href: string, base: string): string | null {
  // El href viene del HTML: `&amp;` es UN separador de parámetros, no tres caracteres.
  // Sin decodificar, el BOPA de Asturias devolvía 200 con los parámetros ROTOS
  // (`amp;p_p_lifecycle=…`) → la página existe pero NO es la disposición pedida. Es el
  // caso de libro de "un 200 no prueba nada" (feedback-verificar-el-arreglo-no-declararlo).
  const h = (href ?? '')
    .trim()
    .replace(/&amp;/gi, '&')
    .replace(/&#0*38;/g, '&')
    .replace(/&quot;/gi, '"')
  if (!h || h.startsWith('#') || /^(javascript|mailto|tel):/i.test(h)) return null
  let u: URL
  try {
    u = new URL(h, base)
  } catch {
    return null
  }
  // Portada del boletín (raíz o `index.php` sin query): es navegación, no un anuncio.
  // Adjudicarla sería dar por probada una convocatoria con la home del diario — caso
  // real detectado en la simulación del 28/07 con el DOE de Extremadura.
  if (!u.search && /^\/(index\.(php|html?|jsp))?$/i.test(u.pathname)) return null
  return u.toString()
}

// Marcas que sustituyen a `<a href>` y `</a>`. Sobreviven a htmlToText (no llevan
// `<`/`>`, que es lo que se borra) y no aparecen jamás en el texto de un boletín.
//
// HACEN FALTA LAS DOS (apertura y CIERRE) porque los boletines usan dos maquetaciones
// opuestas y sin el cierre son indistinguibles — comprobado con sumarios reales:
//   (a) el ancla ENVUELVE el título          → `<a href=…>RESOLUCIÓN de …</a>`
//   (b) el título va suelto y los enlaces van DESPUÉS (BOCYL 22/07/2026):
//       `<p>RESOLUCIÓN de 17 de julio…</p><ul><li><a href=…>…pdf</a></li></ul>`
// En las dos, el trozo ANTERIOR acaba en marca de apertura, así que mirar solo "acaba
// en marca" adjudicaría a la convocatoria (b) el documento de la disposición ANTERIOR.
const MARCA_ANCLA_RE = /⟦L(\d+)⟧/g
const MARCA_TODAS_RE = /⟦(?:L\d+|\/)⟧/g
const marcaAncla = (i: number) => `⟦L${i}⟧`
const MARCA_CIERRE = '⟦/⟧'

/**
 * Igual que `htmlToText` pero CONSERVANDO los enlaces: cada `<a href>` deja una marca
 * `⟦Ln⟧` en el texto y su URL absoluta en `urls[n]`. Así se puede trocear el sumario
 * por disposición y saber, después, a qué anuncio apunta cada trozo.
 * PURA (la fixture del test es HTML real del BOCYL).
 */
export function htmlToTextConAnclas(
  html: string,
  base: string,
): { texto: string; urls: string[] } {
  const urls: string[] = []
  const conMarcas = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Los comentarios llevan enlaces MUERTOS (el BOCYL deja variantes comentadas del
    // mismo `<li>`): si no se quitan, entran en la lista como si fueran visibles.
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi, (_m, href: string) => {
      const abs = absolutizarUrl(href, base)
      if (!abs) return ' '
      urls.push(abs)
      return ` ${marcaAncla(urls.length - 1)} `
    })
    .replace(/<\/a\s*>/gi, ` ${MARCA_CIERRE} `)
  return { texto: htmlToText(conMarcas), urls }
}

/** Quita las marcas de un texto (para que el título no las lleve). */
const sinMarcas = (s: string) => s.replace(MARCA_TODAS_RE, ' ').replace(/\s+/g, ' ').trim()

/** Índices de ancla presentes en un trozo, en orden de aparición. */
function marcasDe(trozo: string): number[] {
  return [...trozo.matchAll(MARCA_ANCLA_RE)].map((m) => Number(m[1]))
}

/**
 * Si el trozo anterior deja un ancla ABIERTA (marca de apertura sin cierre después), el
 * título de este trozo está DENTRO de ese enlace → maquetación (a). Devuelve su índice.
 */
function anclaAbiertaAlEntrar(trozoAnterior: string): number | undefined {
  const ultimaApertura = [...trozoAnterior.matchAll(MARCA_ANCLA_RE)].pop()
  if (!ultimaApertura) return undefined
  const resto = trozoAnterior.slice(ultimaApertura.index + ultimaApertura[0].length)
  return resto.includes(MARCA_CIERRE) ? undefined : Number(ultimaApertura[1])
}

/**
 * Entre los enlaces que van DETRÁS del título (maquetación b), prefiere el HTML al PDF:
 * el PDF de un boletín no siempre trae la ficha de análisis con el desglose de plazas, y
 * clonar el PDF en vez de la página fue justo como se perdió el «561» de Madrid (T-190).
 * Solo mira los primeros enlaces del trozo: más allá ya son de la disposición siguiente.
 */
function preferirHtml(indices: number[], urls: string[]): number | undefined {
  const cercanos = indices.slice(0, 4)
  const noPdf = cercanos.find((i) => urls[i] && !/\.pdf(\?|#|$)/i.test(urls[i]))
  return noPdf ?? cercanos[0]
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Extrae de un sumario en texto las disposiciones candidatas a convocatoria
 * C1/C2. PURA: se testea con una fixture. Parte por los encabezados de
 * disposición (RESOLUCIÓN/ORDEN/ACUERDO/EXTRACTO) y filtra por heurística.
 */
// Lookahead que trocea un sumario en disposiciones. Cubre MAYÚSCULAS (BOE, BOCYL)
// y Title Case (BOJA, BOPA, BOC-Cantabria… "Orden"/"Resolución"). NO matchea el
// "orden" en minúscula de la prosa (cabecera = primera letra mayúscula o todo caps).
// El negative lookbehind evita partir en referencias INTERNAS a otra norma dentro
// del mismo título ("…por la que se modifica la Orden PRE/76/2024…"): así el título
// completo (que puede citar la Orden que modifica) queda en un solo trozo.
const DISPOSICION_SPLIT_RE =
  /(?<!\b(?:la|el|de|del|las|los|una?|dicha|misma|citada|referida|mencionada)\s)(?=Resoluci[óo]n |RESOLUCI[ÓO]N |Orden |ORDEN |Acuerdo |ACUERDO |Decreto |DECRETO |Extracto |EXTRACTO )/

/**
 * Igual que `extractCandidatesFromSumarioText` pero devolviendo, con cada título, el
 * enlace al anuncio concreto (si el sumario venía de `htmlToTextConAnclas`).
 *
 * REGLA DE ADJUDICACIÓN DEL ENLACE (verificada contra sumarios reales de los dos tipos):
 *   1. Si al empezar el trozo hay un ancla ABIERTA, el título está dentro de ese enlace
 *      → es el suyo (maquetación «el ancla envuelve el título»).
 *   2. Si no, el enlace va detrás del título, dentro del propio trozo (BOCYL: `<p>` con
 *      el título y luego el `<ul>` de descargas) → se coge de ahí, prefiriendo HTML.
 *   3. Si no hay ninguno → `null`. NUNCA se adivina por cercanía: una URL equivocada es
 *      PEOR que ninguna, porque la señal acabaría citando el documento de otra
 *      convocatoria y eso es una prueba falsa.
 */
export function extractCandidatosFromSumarioText(
  text: string,
  urls: string[] = [],
  maxPerDay = 40,
): CandidatoSumario[] {
  const parts = text.split(DISPOSICION_SPLIT_RE)
  const hits: CandidatoSumario[] = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (looksLikeC1C2Convocatoria(p)) {
      // recorta a la frase de la disposición (hasta la ref del boletín o 260 chars)
      const title = sinMarcas(p)
        .slice(0, 260)
        .replace(/\s+(BOCYL|BOE|BOJA|BOCM)-.*$/i, '')
        .trim()
      if (title) {
        const idx =
          (i > 0 ? anclaAbiertaAlEntrar(parts[i - 1]) : undefined) ??
          preferirHtml(marcasDe(p), urls)
        hits.push({ titulo: title, url: idx === undefined ? null : (urls[idx] ?? null) })
      }
    }
    if (hits.length >= maxPerDay) break
  }
  return hits
}

/**
 * Compatibilidad: la forma "solo títulos". Delega en `extractCandidatosFromSumarioText`
 * para que exista UNA sola regla de troceo/recorte (si divergen, el texto que ve el LLM
 * dejaría de casar con el candidato al que se le pega el enlace).
 */
export function extractCandidatesFromSumarioText(text: string, maxPerDay = 40): string[] {
  return extractCandidatosFromSumarioText(text, [], maxPerDay).map((c) => c.titulo)
}

// ============================================================
// BOCYL — Boletín Oficial de Castilla y León (HTML por fecha)
// ============================================================
export const bocylAdapter: BoletinAdapter = {
  key: 'bocyl',
  regionName: 'Castilla y León (BOCYL)',
  sensorType: 'regional_scan',
  async scan(date: Date): Promise<BoletinHit | null> {
    const url = `https://bocyl.jcyl.es/boletin.do?fechaBoletin=${pad(date.getDate())}/${pad(
      date.getMonth() + 1,
    )}/${date.getFullYear()}`
    let html: string
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      if (r.status !== 200) return null
      html = await r.text()
    } catch {
      return null
    }
    // Sin sumario real (días sin boletín devuelven una página corta)
    if (html.length < 2000) return null
    const { texto, urls } = htmlToTextConAnclas(html, url)
    const candidatos = extractCandidatosFromSumarioText(texto, urls)
    const temario = extractTemarioCandidatesFromSumarioText(texto)
    return {
      url,
      candidatos,
      candidatesText: candidatos.map((c) => c.titulo).join('\n'),
      temarioText: temario.join('\n'),
    }
  },
}

// ============================================================
// BOE — Boletín Oficial del Estado (API JSON de sumario)
// ============================================================
/** Recorre el JSON del sumario del BOE y devuelve los títulos de disposiciones. */
export function collectBoeTitulos(node: unknown, acc: string[] = []): string[] {
  for (const e of collectBoeEntradas(node)) acc.push(e.titulo)
  return acc
}

/**
 * Igual que `collectBoeTitulos` pero conservando el enlace del propio item del sumario
 * del BOE (`url_pdf.texto` o `url_html.texto`), que es el anuncio CONCRETO — no el
 * diario entero. Mismo recorrido y mismo orden que la versión de solo títulos. [T-221]
 */
export function collectBoeEntradas(node: unknown, acc: CandidatoSumario[] = []): CandidatoSumario[] {
  if (Array.isArray(node)) {
    for (const x of node) collectBoeEntradas(x, acc)
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    if (typeof obj.titulo === 'string') acc.push({ titulo: obj.titulo, url: urlDeItemBoe(obj) })
    for (const k of Object.keys(obj)) collectBoeEntradas(obj[k], acc)
  }
  return acc
}

/**
 * `url_pdf`/`url_html` del BOE vienen como `{texto: "https://…"}` (o string suelto).
 * Se PREFIERE el HTML: el PDF del BOE no lleva la ficha de análisis (donde el BOE pone
 * los totales por turno), y clonar el PDF fue justo como se perdió el «561» de T-190.
 */
function urlDeItemBoe(obj: Record<string, unknown>): string | null {
  for (const k of ['url_html', 'url_pdf']) {
    const v = obj[k]
    if (typeof v === 'string' && v) return v
    if (v && typeof v === 'object') {
      const t = (v as Record<string, unknown>).texto
      if (typeof t === 'string' && t) return t
    }
  }
  return null
}

export const boeAdapter: BoletinAdapter = {
  key: 'boe',
  regionName: 'Estado (BOE)',
  sensorType: 'boe_api',
  async scan(date: Date): Promise<BoletinHit | null> {
    const ymd = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    const url = `https://www.boe.es/datosabiertos/api/boe/sumario/${ymd}`
    let json: unknown
    try {
      const r = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      })
      if (r.status !== 200) return null
      json = await r.json()
    } catch {
      return null
    }
    const entradas = collectBoeEntradas(json)
    // El item del sumario del BOE trae su propio enlace → el candidato cita el ANUNCIO,
    // no el sumario del día (que es lo que hasta ahora llegaba a la señal). [T-221]
    const candidatos = entradas
      .filter((e) => looksLikeC1C2Convocatoria(e.titulo))
      .map((e) => ({ titulo: e.titulo.slice(0, 260), url: e.url }))
    const temario = entradas
      .map((e) => e.titulo)
      .filter((t) => looksLikeTemarioChange(t))
      .map((t) => t.slice(0, 300))
    return {
      url,
      candidatos,
      candidatesText: candidatos.map((c) => c.titulo).join('\n'),
      temarioText: temario.join('\n'),
    }
  },
}

export const BOLETIN_ADAPTERS: BoletinAdapter[] = [bocylAdapter, boeAdapter]
