// lib/temario/pdf/pdfCache.ts
//
// Caché CONTENT-ADDRESSED de los PDFs pre-generados del temario, en S3 (bucket lógico
// `temario-pdf` dentro de vence-uploads).
//
// Idea: la clave de S3 incluye un HASH del contenido del tema. El endpoint calcula el hash
// del contenido ACTUAL y busca esa clave:
//   - existe  → sirve el PDF ya generado (instantáneo, cualquier tamaño, sin límite de 60s).
//   - no      → cae al camino síncrono (genera si cabe, o 413 → imprimir).
// Si cambia el articulado o el `topic_scope`, cambia el hash → cambia la clave → miss →
// se regenera. NO hacen falta hooks de invalidación: el hash ES la versión. El PDF viejo
// queda huérfano (una lifecycle rule de S3 lo limpia; ver docs/roadmap). Diseño idéntico en
// espíritu al content-addressing de los assets estáticos de Next.

import { createHash } from 'crypto'

/** Bucket lógico (= prefijo dentro de `vence-uploads`) de los PDFs pre-generados. */
export const TOPIC_PDF_BUCKET = 'temario-pdf'

/** Forma mínima del contenido del tema que necesita el hash (subconjunto de TopicContent). */
export interface PdfHashableContent {
  laws?: Array<{ articles?: Array<{ articleNumber?: string | null; content?: string | null }> }>
}

/**
 * Hash estable y determinista del contenido de un tema (16 hex = 64 bits, colisión
 * despreciable para este dominio). Cubre el número de artículo Y su texto (que ya incluye
 * las notas de vigencia renderizadas): cualquier cambio de contenido o de scope lo mueve.
 * Los separadores (\x00/\x01/\x02) evitan colisiones por concatenación ambigua.
 */
export function topicPdfContentHash(content: PdfHashableContent): string {
  const h = createHash('sha256')
  for (const law of content.laws || []) {
    for (const a of law.articles || []) {
      h.update(a.articleNumber || '')
      h.update('\x00')
      h.update(a.content || '')
      h.update('\x01')
    }
    h.update('\x02')
  }
  return h.digest('hex').slice(0, 16)
}

/**
 * Ruta del PDF pre-generado DENTRO del bucket lógico `temario-pdf`.
 * Formato: `<oposicion>/<tema>-<hash>.pdf`. El slug ya viene normalizado (guiones).
 */
export function topicPdfCacheKey(oposicionSlug: string, topicNumber: number, contentHash: string): string {
  return `${oposicionSlug}/${topicNumber}-${contentHash}.pdf`
}
