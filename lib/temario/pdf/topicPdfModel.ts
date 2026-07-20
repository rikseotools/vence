// lib/temario/pdf/topicPdfModel.ts — transforma el TopicContent del temario en un modelo
// PLANO listo para maquetar en PDF. Función PURA: sin React, sin BD, sin @react-pdf.
//
// Por qué existe separada del componente: así se testea la parte que de verdad puede
// romperse (qué entra, en qué orden, cómo se sanea el texto legal) sin montar un renderer.
//
// Contexto: hasta ahora el botón "Imprimir PDF" llamaba a window.print(), que en iOS y en
// navegadores in-app (app de Google, Instagram…) NO descarga nada. El PDF se genera ahora
// en servidor, así que la descarga funciona en cualquier navegador.

import type { TopicContent } from '@/lib/api/temario/schemas'

export interface PdfArticle {
  /** Encabezado ya compuesto: "Artículo 12. Título" (o solo el número si no hay título). */
  heading: string
  /** Párrafos del artículo, ya troceados y limpios. */
  paragraphs: string[]
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

export interface PdfLawSection {
  lawName: string
  lawShortName: string
  groups: PdfGroup[]
}

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

/** ¿Cabe este tema en una generación sincrónica? */
export function fitsSyncPdf(totalChars: number): boolean {
  return totalChars <= PDF_MAX_CHARS
}

/** Caracteres totales de texto legal de un TopicContent (para decidir el guardarraíl). */
export function countContentChars(content: { laws?: Array<{ articles?: Array<{ content?: string | null }> }> }): number {
  return (content.laws || []).reduce(
    (n, l) => n + (l.articles || []).reduce((m, a) => m + (a.content?.length || 0), 0), 0)
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

/**
 * Normaliza el texto legal para maquetarlo:
 * - normaliza saltos de línea y quita espacios de sobra
 * - trocea en párrafos por línea en blanco O por salto simple (el articulado usa ambos)
 * - descarta párrafos vacíos
 *
 * No "embellece" el contenido: es texto legal y debe salir tal cual está en la fuente.
 */
export function splitParagraphs(content: string | null | undefined): string[] {
  if (!content) return []
  return content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(p => p.replace(/[ \t]+/g, ' ').trim())
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
 */
export function groupArticles(
  articles: Array<{ articleNumber: string; title: string | null | undefined; paragraphs: string[] }>
): PdfGroup[] {
  const groups: PdfGroup[] = []
  for (const a of articles) {
    const t = (a.title || '').trim()
    const prev = groups[groups.length - 1]
    const sharedWithPrev = prev != null && prev.heading === t && t !== ''
    if (sharedWithPrev) {
      prev.articles.push({ heading: articleLabel(a.articleNumber), paragraphs: a.paragraphs })
      continue
    }
    // Grupo nuevo: se abre "en tentativa" con su título; si luego llega otro artículo
    // con el mismo título, se confirma como rúbrica de estructura.
    groups.push({ heading: t || null, articles: [{ heading: articleLabel(a.articleNumber), paragraphs: a.paragraphs }] })
  }
  // Un grupo de UN solo artículo con título = rúbrica propia del artículo → se fusiona
  // en su encabezado y el grupo se queda sin cabecera.
  return groups.map(g =>
    g.heading != null && g.articles.length === 1
      ? { heading: null, articles: [{ ...g.articles[0], heading: articleHeading(g.articles[0].heading.replace(/^Artículo\s+/, ''), g.heading) }] }
      : g)
}

/** Nombre de fichero seguro y reconocible: "subalterno-parlamento-andalucia-tema-4.pdf". */
export function pdfFileName(oposicionSlug: string, topicNumber: number): string {
  const slug = oposicionSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-tema-${topicNumber}.pdf`
}

/**
 * Construye el modelo del PDF a partir del contenido del tema.
 * `generatedAt` se inyecta (no se lee el reloj aquí) para que el resultado sea determinista
 * y los tests no dependan de la hora.
 */
export function buildTopicPdfModel(content: TopicContent, generatedAt: Date): TopicPdfModel {
  const sections: PdfLawSection[] = (content.laws || []).map(entry => {
    const conTexto = (entry.articles || [])
      .map(a => ({ articleNumber: a.articleNumber, title: a.title, paragraphs: splitParagraphs(a.content) }))
      // Un artículo sin texto no aporta nada al PDF (p.ej. los que solo son rejilla).
      .filter(a => a.paragraphs.length > 0)
    return {
      lawName: entry.law.name || entry.law.shortName,
      lawShortName: entry.law.shortName,
      groups: groupArticles(conTexto),
    }
  }).filter(s => s.groups.length > 0)

  const fecha = generatedAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

  return {
    title: `Tema ${content.topicNumber}. ${content.title}`,
    subtitle: content.description?.trim() || '',
    oposicionName: content.oposicionName,
    footer: `Vence · ${content.oposicionName} · Generado el ${fecha}`,
    sections,
    totalArticles: sections.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.articles.length, 0), 0),
  }
}
