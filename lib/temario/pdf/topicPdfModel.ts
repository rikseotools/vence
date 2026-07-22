// lib/temario/pdf/topicPdfModel.ts — transforma el TopicContent del temario en un modelo
// PLANO listo para maquetar en PDF. Función PURA: sin React, sin BD, sin @react-pdf.
//
// Por qué existe separada del componente: así se testea la parte que de verdad puede
// romperse (qué entra, en qué orden, cómo se sanea el texto legal) sin montar un renderer.
//
// El PDF se genera en servidor (@react-pdf/renderer), así que la descarga funciona en
// cualquier navegador (a diferencia del antiguo window.print(), que no descargaba en iOS
// ni en navegadores in-app).

import type { TopicContent } from '@/lib/api/temario/schemas'
import { parseMarkdownBlocks, blocksHaveContent, type MdBlock } from './markdownBlocks'

export type { MdBlock, MdSpan } from './markdownBlocks'

export interface PdfArticle {
  /** Encabezado ya compuesto: "Artículo 12. Título" (o solo el número si no hay título). */
  heading: string
  /** Cuerpo del artículo en bloques markdown (párrafos, listas, tablas…). */
  body: MdBlock[]
}

/**
 * Agrupación intermedia por rúbrica de estructura (Título/Capítulo).
 *
 * Muchos artículos NO traen su rúbrica propia en `title`, sino la RUTA de estructura
 * ("TÍTULO PRELIMINAR. De la sesión constitutiva del Parlamento"), idéntica para todos los
 * artículos de ese capítulo. Si se pintara en cada artículo, el PDF repetiría la misma línea
 * decenas de veces. Se saca una sola vez como subtítulo y debajo van sus artículos.
 */
export interface PdfGroup {
  /** Rúbrica común (Título/Capítulo), o null si cada artículo trae la suya propia. */
  heading: string | null
  articles: PdfArticle[]
}

/**
 * Bloque del cuerpo de una ley en el PDF: o una CABECERA de estructura (Título / Capítulo /
 * Sección) o un ARTÍCULO. El renderer los pinta en orden con estilos por nivel.
 */
export type PdfBlock =
  | { kind: 'heading'; level: 'titulo' | 'capitulo' | 'seccion'; text: string }
  | { kind: 'article'; heading: string; body: MdBlock[] }

export interface PdfLawSection {
  lawName: string
  lawShortName: string
  /** Cuerpo de la ley: cabeceras de estructura + artículos, ya en orden de lectura. */
  blocks: PdfBlock[]
}

/**
 * Diccionario de NOMBRES de estructura por ley (de `law_sections`), para que las cabeceras
 * digan "Título I. De los derechos y deberes fundamentales" y no solo "Título I". Lo inyecta
 * la ruta del PDF; es opcional (sin él, se cae a los numerales). Clave: lawId.
 */
export type LawSectionNames = Record<string, {
  titulo?: Record<string, string>
  capitulo?: Record<string, string>
}>

/**
 * Techo de caracteres para generar el PDF sincrónicamente.
 *
 * Medido (20/07) sobre los 3.325 temas vivos: 300k chars (≈167 págs) rinden en ~7 s, pero
 * el tema más gordo (1.369k, ≈760 págs) no baja de 3 minutos → timeout garantizado.
 * A 400k se cubre el ~96% de los temas con holgura dentro del maxDuration de 60 s.
 *
 * Los que exceden son los "artículos-cajón" de T-040 (mega-chunks de una app entera en un
 * solo artículo). Para ellos el botón degrada a la impresión del navegador, que es lo que
 * había antes — no se rompe nada, simplemente no mejora hasta que T-040 los trocee.
 */
export const PDF_MAX_CHARS = 400_000

/**
 * Techo por ARTÍCULO individual (complementa al total).
 *
 * El total no basta: un tema puede estar por DEBAJO de PDF_MAX_CHARS y aun así dar 504
 * (caso Julen 21/07, T19 aux-Madrid = 334k total < 400k, pero un solo "artículo-cajón" de
 * 89k). El layout de @react-pdf/renderer es super-lineal para un bloque gigante único →
 * un artículo enorme tarda minutos aunque el tema total sea moderado. Medido (22/07): los
 * artículos activos tienen p99 = 9k y los legítimos grandes ~37k; los cajones (T-040)
 * arrancan en ~89k y suben a 295k. 60k separa limpio: por encima de lo legítimo, por debajo
 * de cualquier cajón. Superarlo devuelve 413 (degradación graciosa a imprimir), no 504 duro.
 */
export const PDF_MAX_ARTICLE_CHARS = 60_000

/** ¿Cabe este tema en una generación sincrónica? (total Y ningún artículo-cajón) */
export function fitsSyncPdf(totalChars: number, maxArticleChars = 0): boolean {
  return totalChars <= PDF_MAX_CHARS && maxArticleChars <= PDF_MAX_ARTICLE_CHARS
}

/** Caracteres totales de texto legal de un TopicContent (para decidir el guardarraíl). */
export function countContentChars(content: { laws?: Array<{ articles?: Array<{ content?: string | null }> }> }): number {
  return (content.laws || []).reduce(
    (n, l) => n + (l.articles || []).reduce((m, a) => m + (a.content?.length || 0), 0), 0)
}

/** Tamaño del ARTÍCULO más grande (para el guardarraíl por-artículo anti-cajón). */
export function maxArticleChars(content: { laws?: Array<{ articles?: Array<{ content?: string | null }> }> }): number {
  let max = 0
  for (const l of content.laws || []) for (const a of l.articles || []) {
    const n = a.content?.length || 0
    if (n > max) max = n
  }
  return max
}

export interface TopicPdfModel {
  title: string
  subtitle: string
  oposicionName: string
  /** Pie de página: de dónde sale y cuándo se generó. */
  footer: string
  sections: PdfLawSection[]
  totalArticles: number
}

// Rango de caracteres de "dibujo": box-drawing (U+2500–257F), bloques (U+2580–259F) y formas
// geométricas (U+25A0–25FF). Son artefactos de importación (líneas ═──, viñetas ■●) que la
// fuente del PDF NO tiene y renderiza como basura (═ = U+2550; su byte bajo 0x50 = 'P', de ahí
// las "PPPP" que se veían). No aparecen en texto legal legítimo → se eliminan.
const DECORATIVE_GLYPHS = /[\u2500-\u25ff]/g

/**
 * Normaliza el texto legal para maquetarlo:
 * - normaliza saltos de línea y quita espacios de sobra
 * - elimina glifos decorativos de import (líneas box-drawing, viñetas) que la fuente no pinta
 * - trocea en párrafos por línea en blanco O por salto simple (el articulado usa ambos)
 * - descarta párrafos vacíos (una línea que solo era "═══" desaparece del todo)
 *
 * No "embellece" el contenido legal: solo lo sanea de basura no imprimible.
 */
export function splitParagraphs(content: string | null | undefined): string[] {
  if (!content) return []
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(p => p.replace(DECORATIVE_GLYPHS, '').replace(/[ \t]+/g, ' ').trim())
    .filter(p => p.length > 0)
}

/** Etiqueta corta del artículo: "Artículo 12" (o el literal si no es numérico). */
export function articleLabel(articleNumber: string): string {
  return /^\d+$/.test(articleNumber) ? `Artículo ${articleNumber}` : articleNumber
}

/**
 * Encabezado del artículo cuando SÍ tiene rúbrica propia.
 * Si la rúbrica es de estructura (compartida), no se usa aquí: va como cabecera de grupo.
 */
export function articleHeading(articleNumber: string, title: string | null | undefined): string {
  const num = articleLabel(articleNumber)
  const t = (title || '').trim()
  if (!t) return num
  // Evita "Artículo 3. Artículo 3. Honor" cuando el título ya repite el número.
  if (t.toLowerCase().startsWith(num.toLowerCase())) return t
  return `${num}. ${t}`
}

/**
 * Agrupa artículos consecutivos que comparten exactamente el mismo `title`.
 * Un título repetido en ≥2 artículos seguidos es una rúbrica de ESTRUCTURA
 * (Título/Capítulo), no la del artículo → se saca como cabecera del grupo.
 *
 * FALLBACK: se usa solo para leyes SIN metadatos de estructura (title_number null en toda la
 * ley). Cuando la ley SÍ tiene estructura poblada, se agrupa por esos metadatos (más fiable).
 */
export function groupArticles(
  articles: Array<{ articleNumber: string; title: string | null | undefined; body: MdBlock[] }>
): PdfGroup[] {
  const groups: PdfGroup[] = []
  for (const a of articles) {
    const t = (a.title || '').trim()
    const prev = groups[groups.length - 1]
    const sharedWithPrev = prev != null && prev.heading === t && t !== ''
    if (sharedWithPrev) {
      prev.articles.push({ heading: articleLabel(a.articleNumber), body: a.body })
      continue
    }
    groups.push({ heading: t || null, articles: [{ heading: articleLabel(a.articleNumber), body: a.body }] })
  }
  return groups.map(g =>
    g.heading != null && g.articles.length === 1
      ? { heading: null, articles: [{ ...g.articles[0], heading: articleHeading(g.articles[0].heading.replace(/^Artículo\s+/, ''), g.heading) }] }
      : g)
}

/** Convierte los grupos del fallback en bloques (cabecera de grupo + artículos). */
function groupsToBlocks(groups: PdfGroup[]): PdfBlock[] {
  const blocks: PdfBlock[] = []
  for (const g of groups) {
    if (g.heading) blocks.push({ kind: 'heading', level: 'titulo', text: g.heading })
    for (const a of g.articles) blocks.push({ kind: 'article', heading: a.heading, body: a.body })
  }
  return blocks
}

interface StructuredArticle {
  articleNumber: string
  title: string | null | undefined
  titleNumber: string | null | undefined
  chapterNumber: string | null | undefined
  section: string | null | undefined
  body: MdBlock[]
}

/**
 * Construye los bloques de UNA ley con cabeceras de estructura reales (Título/Capítulo/Sección),
 * emitiendo una cabecera solo cuando el nivel CAMBIA a un valor no nulo. Los nombres completos
 * salen de `names` (law_sections); si faltan, se cae al numeral ("Título I").
 */
export function buildLawBlocks(
  articles: StructuredArticle[],
  names?: { titulo?: Record<string, string>; capitulo?: Record<string, string> }
): PdfBlock[] {
  const hasStructure = articles.some(a => (a.titleNumber || '').trim() !== '')
  if (!hasStructure) {
    // Sin metadatos de estructura: heurística de rúbrica repetida (leyes sin poblar).
    return groupsToBlocks(groupArticles(articles.map(a => ({ articleNumber: a.articleNumber, title: a.title, body: a.body }))))
  }

  const blocks: PdfBlock[] = []
  let curTitulo: string | null = null
  let curCapitulo: string | null = null
  let curSeccion: string | null = null

  const tituloText = (n: string) => names?.titulo?.[n] || `Título ${n}`
  const capituloText = (n: string) => names?.capitulo?.[n] || `Capítulo ${n}`

  for (const a of articles) {
    const tn = (a.titleNumber || '').trim() || null
    const cn = (a.chapterNumber || '').trim() || null
    const sec = (a.section || '').trim() || null

    if (tn && tn !== curTitulo) {
      blocks.push({ kind: 'heading', level: 'titulo', text: tituloText(tn) })
      curTitulo = tn
      curCapitulo = null
      curSeccion = null
    }
    if (cn && cn !== curCapitulo) {
      blocks.push({ kind: 'heading', level: 'capitulo', text: capituloText(cn) })
      curCapitulo = cn
      curSeccion = null
    }
    if (sec && sec !== curSeccion) {
      blocks.push({ kind: 'heading', level: 'seccion', text: /secci[oó]n/i.test(sec) ? sec : `Sección ${sec}` })
      curSeccion = sec
    }
    blocks.push({ kind: 'article', heading: articleHeading(a.articleNumber, a.title), body: a.body })
  }
  return blocks
}

/** Nombre de fichero seguro y reconocible: "subalterno-parlamento-andalucia-tema-4.pdf". */
export function pdfFileName(oposicionSlug: string, topicNumber: number): string {
  const slug = oposicionSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-tema-${topicNumber}.pdf`
}

/**
 * Construye el modelo del PDF a partir del contenido del tema.
 * `generatedAt` se inyecta (no se lee el reloj aquí) para que el resultado sea determinista.
 * `sectionNames` (opcional) trae los nombres de Título/Capítulo de law_sections por ley.
 */
// Solo los campos que este builder lee. Así acepta tanto el TopicContent completo (route) como el
// TopicContentBase que devuelve la variante uncached (pre-gen/worker, sin isUnlocked/unlockReq).
type PdfContentInput = Pick<TopicContent, 'topicNumber' | 'title' | 'description' | 'oposicionName' | 'laws'>

export function buildTopicPdfModel(
  content: PdfContentInput,
  generatedAt: Date,
  sectionNames?: LawSectionNames
): TopicPdfModel {
  const sections: PdfLawSection[] = (content.laws || []).map(entry => {
    const conTexto: StructuredArticle[] = (entry.articles || [])
      .map(a => ({
        articleNumber: a.articleNumber,
        title: a.title,
        titleNumber: a.titleNumber,
        chapterNumber: a.chapterNumber,
        section: a.section,
        body: parseMarkdownBlocks(a.content),
      }))
      // Un artículo sin texto no aporta nada al PDF (p.ej. los que solo son rejilla).
      .filter(a => blocksHaveContent(a.body))
    return {
      lawName: entry.law.name || entry.law.shortName,
      lawShortName: entry.law.shortName,
      blocks: buildLawBlocks(conTexto, sectionNames?.[entry.law.id]),
    }
  }).filter(s => s.blocks.length > 0)

  const fecha = generatedAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  return {
    title: `Tema ${content.topicNumber}. ${content.title}`,
    subtitle: content.description?.trim() || '',
    oposicionName: content.oposicionName,
    footer: `Vence · ${content.oposicionName} · Generado el ${fecha}`,
    sections,
    totalArticles: sections.reduce((n, s) => n + s.blocks.filter(b => b.kind === 'article').length, 0),
  }
}
