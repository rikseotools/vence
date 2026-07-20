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

/** Una anulación del TC extraída del análisis BOE: sentencia + artículos afectados. */
export interface TcAnnulment {
  idNorma: string | null // BOE-A-... de la sentencia
  sentencia: string | null // 'STC 103/2013' si se puede extraer del texto
  articles: string[] // números de artículo ANULADOS/inconstitucionales (p.ej. ['126'])
  texto: string
}

const ART_RE = /art(?:[íi]culos?|\.|\b)\s*(\d+(?:\s*bis)?)/gi
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
export function articleCarriesVigenciaNote(content: string | null | undefined): boolean {
  const t = content || ''
  if (/nota\s+de\s+vigencia/i.test(t)) return true
  // "declarad(o) inconstitucional y nulo ... por (la )?(STC|Sentencia) N/AAAA"
  if (/declarad[oa]s?\b[\s\S]{0,60}\b(?:inconstitucional|nul)[\s\S]{0,80}\b(?:STC|Sentencia)\s+\d+\/\d{4}/i.test(t)) return true
  return false
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
    for (const artNum of a.articles) {
      const content = articlesByNumber.get(artNum)
      if (content === undefined) continue // no servimos ese artículo → no es nuestro problema
      if (articleCarriesVigenciaNote(content)) continue // ya marcado → ok
      findings.push({ articleNumber: artNum, sentencia: a.sentencia, idNorma: a.idNorma, texto: a.texto })
    }
  }
  return findings
}
