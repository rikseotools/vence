// Detector de disposiciones/incisos ANULADOS por el Tribunal Constitucional (o
// declarados inconstitucionales) que nuestro import de la ley NO marcó con nota de
// vigencia → riesgo de que la clave de una pregunta dé por válido un inciso anulado.
//
// Nació del incidente 19/07 (art. 126.2 LBRL: inciso de nombrar no-concejales a la
// Junta de Gobierno Local, declarado inconstitucional y nulo por STC 103/2013 —
// nuestro artículo no tenía la nota y la clave daba el inciso anulado como correcto).
//
// HUECO que cierra: el monitor BOE ve cambios FUTUROS; completitud-leyes ve artículos
// que FALTAN; nada vigilaba la VIGENCIA de incisos ya anulados en el consolidado.
//
// FUENTE (robusta): API datosabiertos del BOE `…/legislacion-consolidada/id/<BOE-ID>/analisis`
// → `data[0].referencias.posteriores[0].posterior[]`, cada una con `relacion.texto`
// ('SE DECLARA'), `id_norma` (BOE de la sentencia) y `texto` (describe qué se declara
// y sobre qué artículos). Ver scripts/audit-annulled-provisions.cjs.
//
// Este módulo es LÓGICA PURA (sin red ni BD) para poder testearlo.

import { parseBoeBlock } from './boeVigencia'

/** Forma de `articles.vigencia_notes` (JSONB que escribe `capturar-vigencia-articulo.cjs`). */
export interface VigenciaNotesColumn {
  notes?: Array<{ esAnulacion?: boolean; esCompetencial?: boolean; texto?: string }> | null
}

/** Una anulación del TC extraída del análisis BOE: sentencia + artículos afectados. */
export interface TcAnnulment {
  idNorma: string | null // BOE-A-... de la sentencia
  sentencia: string | null // 'STC 103/2013' si se puede extraer del texto
  articles: string[] // números de artículo ANULADOS/inconstitucionales (p.ej. ['126'])
  texto: string
}

// OJO con las abreviaturas: el BOE escribe las enumeraciones como "arts. 46.4, 80.2 y
// 347.3". La forma PLURAL abreviada ("arts.") no la casaba la versión original
// —`art` + (`ículos?` | `.` | frontera)— porque tras "art" viene una "s" que no es ni
// punto ni frontera de palabra. Consecuencia medida el 26/07 (T-132): de la referencia de
// la STC 68/2021 sobre la LCSP no se extraía NI UN artículo, y por eso el kind
// `article_annulled_unmarked` llevaba 0 findings.
const ART_RE = /art(?:[íi]culos?|s?\.|\b)\s*(\d+(?:\s*bis)?)/gi
// Los siguientes elementos de una enumeración YA NO llevan el prefijo "art":
// "arts. 46.4, 80.2 y 347.3". Se capturan continuando desde el final del match anterior
// mientras haya separador de lista (coma / "y") y un número con forma de artículo.
const ENUM_NEXT = /^\s*(?:\.\d+)?\s*(?:,|\sy)\s*(\d+(?:\.\d+)?)/
const ANNUL_BEFORE = /\binconstitucional|\bnul(?:idad|o|a|os|as)\b|\banulad/i

/**
 * Extrae los artículos ANULADOS de un `texto` de referencia posterior. El texto suele
 * mezclar artículos MANTENIDOS ('la constitucionalidad del art. 130') con ANULADOS ('la
 * inconstitucionalidad y nulidad ... del art. 126.2'). Un artículo se considera anulado
 * si en los ~50 caracteres ANTERIORES a su mención aparece un marcador de anulación.
 * OJO: `\binconstitucional` NO casa dentro de 'constitucionalidad' (exige el prefijo 'in').
 */
// "art. 1.17 de la Ley 27/2013" / "art. 5 del Real Decreto…" = referencia a OTRA norma
// (no un artículo de ESTA ley) → excluir. Se mira el texto JUSTO DESPUÉS del número.
const CROSSREF_AFTER = /^\s*\.?\d*\s*(?:bis\s*)?de\s+(?:la\s+)?(?:ley|l\.?\s*o\.?|real\s+decreto|rd\b|decreto|reglamento)/i

export function parseAnnulledArticles(texto: string): string[] {
  const out = new Set<string>()
  let m: RegExpExecArray | null
  ART_RE.lastIndex = 0
  while ((m = ART_RE.exec(texto)) !== null) {
    const before = texto.slice(Math.max(0, m.index - 55), m.index)
    if (!ANNUL_BEFORE.test(before)) continue
    const after = texto.slice(m.index + m[0].length, m.index + m[0].length + 40)
    if (CROSSREF_AFTER.test(after)) continue // referencia a otra norma, no a esta ley
    out.add(m[1].replace(/\s+/g, ' ').trim().toLowerCase())

    // Continuar la enumeración: "arts. 46.4, 80.2 y 347.3" → 80 y 347 no llevan prefijo.
    let cursor = m.index + m[0].length
    for (;;) {
      const resto = texto.slice(cursor, cursor + 40)
      const e = resto.match(ENUM_NEXT)
      if (!e) break
      out.add(e[1].split('.')[0])
      cursor += e[0].length
    }
    ART_RE.lastIndex = Math.max(ART_RE.lastIndex, cursor)
  }
  return [...out]
}

/** 'Sentencia 103/2013' → 'STC 103/2013'. null si no aparece. */
export function parseSentencia(texto: string): string | null {
  const m = texto.match(/Sentencia\s+(\d+\/\d{4})/i)
  return m ? `STC ${m[1]}` : null
}

/**
 * Del JSON de análisis del BOE, extrae las anulaciones del TC. Filtra a `relacion.texto`
 * = 'SE DECLARA' cuyo `texto` mencione inconstitucionalidad/nulidad (descarta 'SE DECLARA
 * la constitucionalidad' = mantenido) y que afecte a algún artículo concreto.
 */
export function extractTcAnnulments(analisisJson: any): TcAnnulment[] {
  const posteriores =
    analisisJson?.data?.[0]?.referencias?.posteriores?.[0]?.posterior ?? []
  const res: TcAnnulment[] = []
  for (const p of posteriores) {
    const rel = (p?.relacion?.texto || '').toUpperCase()
    const texto: string = p?.texto || ''
    if (!rel.includes('SE DECLARA')) continue
    if (!/\binconstitucional|\bnul(?:idad|o|a)\b/i.test(texto)) continue // descarta "constitucionalidad"
    const articles = parseAnnulledArticles(texto)
    if (articles.length === 0) continue // sin artículo concreto (p.ej. disp. adicional) → v1 lo deja
    res.push({ idNorma: p?.id_norma ?? null, sentencia: parseSentencia(texto), articles, texto })
  }
  return res
}

/**
 * ¿Nuestro `content` de artículo lleva una NOTA DE VIGENCIA sobre anulación del TC?
 * Debe distinguir la NOTA de un artículo que sencillamente HABLA de constitucionalidad
 * (LOTC, Código Civil 'matrimonio declarado nulo'…) → exige el formato de nota o la
 * fórmula de anulación ligada a una STC/Sentencia con año.
 */
export function articleCarriesVigenciaNote(
  content: string | null | undefined,
  vigenciaNotes?: VigenciaNotesColumn | null,
): boolean {
  // FUENTE CANÓNICA: la columna `articles.vigencia_notes` (T-048). Se comprueba PRIMERO
  // porque es donde escribe `capturar-vigencia-articulo.cjs` y de donde tira el render de
  // teoría (`annotateVigencia`, capa 2) — el `content` NO se toca a propósito, porque las
  // explicaciones lo citan verbatim.
  //
  // Mirar solo el `content` (lo que se hacía hasta el 27/07) tenía un efecto perverso:
  // marcar un artículo con la herramienta CORRECTA no apagaba el aviso, y lo único que lo
  // apagaba era contaminar el `content` — justo lo que el diseño prohíbe. Medido con el
  // art. 607 del CP: tenía ya su `vigencia_notes` y seguía saliendo como hallazgo.
  const notes = vigenciaNotes?.notes
  if (Array.isArray(notes) && notes.some((n) => n?.esAnulacion || n?.esCompetencial)) return true

  const t = content || ''
  // Formato LEGACY (nota escrita a mano dentro del content, como pedía el runbook v1).
  // Se mantiene para no dar por "sin marcar" lo que ya se anotó así antes de T-048.
  if (/nota\s+de\s+vigencia/i.test(t)) return true
  // "declarad(o) inconstitucional y nulo ... por (la )?(STC|Sentencia) N/AAAA"
  if (/declarad[oa]s?\b[\s\S]{0,60}\b(?:inconstitucional|nul)[\s\S]{0,80}\b(?:STC|Sentencia)\s+\d+\/\d{4}/i.test(t)) return true
  return false
}

/**
 * v2 — ¿el BLOQUE del artículo en el consolidado BOE RETIENE el inciso anulado con nota
 * inline? El BOE mantiene el texto tachado + "Declarado inconstitucional y nulo … por
 * Sentencia … del TC …" cuando el legislador NO ha reformado el artículo (caso art. 126).
 * Si el artículo se reformó, el texto anulado desaparece y NO hay nota inline → falsa
 * alarma. Distingue de un artículo que solo HABLA de constitucionalidad (LOTC: "el
 * Tribunal podrá declarar inconstitucionales…" — 'declarar' ≠ 'declarado', y sin Sentencia).
 */
export function boeBlockRetainsAnnulment(blockText: string | null | undefined): boolean {
  const raw = blockText || ''
  const t = raw.replace(/<[^>]+>/g, ' ')

  // (1) MARCA INLINE: el BOE deja el texto tachado + "Declarado inconstitucional y nulo …
  //     por Sentencia … del TC". Es el caso del art. 126.2 LBRL, con el que se diseñó v2.
  if (/(?:declarad[oa]s?\s+(?:inconstitucional|nul)|inconstitucional(?:idad)?\s+y\s+nul)[\s\S]{0,140}\b(?:Sentencia|STC|del\s+TC|Tribunal\s+Constitucional)\b/i.test(t)) return true

  // (2) NOTA AL PIE del bloque (`<blockquote><p class="nota_pie">`). El BOE la usa cuando el
  //     inciso no se puede tachar en el cuerpo — señaladamente en la anulación INDIRECTA:
  //     lo anulado es la norma MODIFICADORA, y el artículo afectado solo lo dice la nota.
  //     Caso medido: art. 16 de la Ley 38/2003 (STC 206/2013, que anuló la DF 11ª de la Ley
  //     2/2008). Se reutiliza el parseo compartido — nada de una quinta copia del regex.
  for (const n of parseBoeBlock(raw).vigenciaNotes) {
    if (n.esAnulacion || n.esCompetencial) return true
  }

  // (3) "(Anulado)" A SECAS en el cuerpo: el BOE sustituye el apartado por esa palabra, sin
  //     tachado ni sentencia al lado. Caso medido: art. 7.1 a) de la Ley 38/2003 (STC 70/2016).
  //     Se exige el paréntesis para no casar con un artículo que HABLE de anulaciones.
  if (/\(\s*anulad[oa]s?\s*\)/i.test(t)) return true

  return false
}

/**
 * ¿La anulación del TC lo fue de la «redacción original» del artículo? (T-208, FP conocido:
 * art. 335 CP / STC 101/2012, "inconstitucional y nulo, en la redacción original, el art.
 * 335" — verificado contra la API BOE datosabiertos el 06/08/2026). Si es así, y el artículo
 * ha sido reformado desde entonces (caso normal: el BOE consolidado ya no trae esa redacción),
 * marcarlo como hallazgo es un falso positivo — no estamos sirviendo el texto anulado, estamos
 * sirviendo una redacción posterior que ni siquiera existía cuando se dictó la sentencia.
 *
 * Es un descarte DELIBERADAMENTE conservador (solo el marcador textual explícito, no una
 * comparación de fechas STC↔reforma): cubre el caso donde el propio BOE ya lo dice, sin
 * arriesgar a callar una anulación que sí sigue vigente. El caso hermano —art. 607 CP / STC
 * 235/2007, sin este marcador pero con el inciso retirado en la reforma de 2015— NO lo
 * cubre esta función; necesita comparar la fecha de la STC contra reformas posteriores del
 * artículo, que queda como trabajo pendiente (ver ficha T-208).
 */
export function annulmentAppliesToOriginalWordingOnly(texto: string): boolean {
  return /redacci[oó]n\s+original/i.test(texto || '')
}

export interface AnnulmentFinding {
  articleNumber: string
  sentencia: string | null
  idNorma: string | null
  texto: string
}

/**
 * Cruza las anulaciones del BOE con nuestros artículos (map número→content). Devuelve
 * los artículos que el TC anuló/declaró inconstitucionales y que NOSOTROS servimos SIN
 * nota de vigencia → candidatos a revisión (posible inciso anulado dado como vigente).
 */
export function assessLawAnnulments(
  annulments: TcAnnulment[],
  articlesByNumber: Map<string, string>,
): AnnulmentFinding[] {
  const findings: AnnulmentFinding[] = []
  for (const a of annulments) {
    if (annulmentAppliesToOriginalWordingOnly(a.texto)) continue // T-208: FP conocido (art. 335 CP)
    for (const artNum of a.articles) {
      const content = articlesByNumber.get(artNum)
      if (content === undefined) continue // no servimos ese artículo → no es nuestro problema
      if (articleCarriesVigenciaNote(content)) continue // ya marcado → ok
      findings.push({ articleNumber: artNum, sentencia: a.sentencia, idNorma: a.idNorma, texto: a.texto })
    }
  }
  return findings
}
