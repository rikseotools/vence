// lib/temario/pdf/pregenerate.ts
//
// Generación OFFLINE de un PDF de tema → caché S3 (content-addressed, ver pdfCache.ts).
// A diferencia del endpoint de descarga, aquí NO hay guardarraíl de tamaño: el objetivo
// es precisamente generar los temas GRANDES (Access/ofimática) que no caben en generación
// síncrona bajo el límite de 60s del ALB. Por eso esto se llama desde un contexto SIN ese
// límite: el endpoint admin lo lanza en una promise DESACOPLADA (post-respuesta) sobre el
// server largo de ECS, o un cron.
//
// Reutiliza EXACTAMENTE el mismo pipeline que el endpoint (getTopicContent → buildTopicPdfModel
// → TopicPdfDocument → renderToBuffer) para que el PDF pre-generado sea idéntico al síncrono.

import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import { getTopicContentBaseInternal as getTopicContentUncached, getLawSectionNames } from '@/lib/api/temario/queries'
import { OPOSICIONES, type OposicionSlug } from '@/lib/api/temario/schemas'
import { buildTopicPdfModel } from '@/lib/temario/pdf/topicPdfModel'
import { TopicPdfDocument } from '@/lib/temario/pdf/TopicPdfDocument'
import { topicPdfContentHash, topicPdfCacheKey, TOPIC_PDF_BUCKET } from '@/lib/temario/pdf/pdfCache'
import { S3StorageAdapter } from '@/lib/storage/s3-adapter'
import { emitFireAndForget } from '@/lib/observability/emit'

export interface PregenResult {
  oposicion: string
  tema: number
  ok: boolean
  /** 'uploaded' = generado y subido; 'skipped' = ya estaba en caché; 'error' = falló. */
  outcome: 'uploaded' | 'skipped' | 'error'
  bytes?: number
  ms?: number
  chars?: number
  error?: string
}

/**
 * Genera (si hace falta) el PDF de un tema y lo sube a la caché S3.
 * - `force` regenera aunque ya exista la clave.
 * Nunca lanza: devuelve el resultado (para que el batch continúe con los demás temas).
 */
export async function pregenerateTopicPdf(
  oposicionRaw: string,
  topicNumber: number,
  opts: { force?: boolean } = {},
): Promise<PregenResult> {
  const oposicion = oposicionRaw.replace(/_/g, '-')
  const base: PregenResult = { oposicion, tema: topicNumber, ok: false, outcome: 'error' }

  if (!(oposicion in OPOSICIONES)) return { ...base, error: 'oposicion_desconocida' }
  if (!Number.isInteger(topicNumber) || topicNumber <= 0) return { ...base, error: 'tema_invalido' }

  const started = Date.now()
  try {
    const content = await getTopicContentUncached(oposicion as OposicionSlug, topicNumber)
    if (!content) return { ...base, error: 'tema_no_encontrado' }

    const contentHash = topicPdfContentHash(content)
    const cacheKey = topicPdfCacheKey(oposicion, topicNumber, contentHash)
    const storage = new S3StorageAdapter()

    if (!opts.force) {
      const existing = await storage.download({ bucket: TOPIC_PDF_BUCKET, path: cacheKey }).catch(() => null)
      if (existing && existing.success) {
        return { oposicion, tema: topicNumber, ok: true, outcome: 'skipped', bytes: existing.data.length }
      }
    }

    const lawIds = (content.laws || []).map((l) => l.law.id).filter(Boolean)
    const sectionNames = await getLawSectionNames(lawIds)
    const model = buildTopicPdfModel(content, new Date(), sectionNames)
    const doc = React.createElement(TopicPdfDocument, { model }) as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(doc)

    const up = await storage.upload({
      bucket: TOPIC_PDF_BUCKET, path: cacheKey, data: buffer, contentType: 'application/pdf',
      cacheControl: 'public, max-age=31536000, immutable',
    })
    const ms = Date.now() - started
    if (!up.success) {
      emitFireAndForget({ source: 'fargate', severity: 'warn', eventType: 'temario_pdf_pregenerated', endpoint: '/api/admin/temario/pregenerate', metadata: { oposicion, tema: topicNumber, outcome: 'upload_failed', error: up.error, ms } })
      return { oposicion, tema: topicNumber, ok: false, outcome: 'error', error: `upload: ${up.error}`, ms }
    }
    emitFireAndForget({ source: 'fargate', severity: 'info', eventType: 'temario_pdf_pregenerated', endpoint: '/api/admin/temario/pregenerate', metadata: { oposicion, tema: topicNumber, outcome: 'uploaded', bytes: buffer.length, ms, hash: contentHash } })
    return { oposicion, tema: topicNumber, ok: true, outcome: 'uploaded', bytes: buffer.length, ms }
  } catch (e) {
    const ms = Date.now() - started
    const error = e instanceof Error ? e.message : 'desconocido'
    emitFireAndForget({ source: 'fargate', severity: 'error', eventType: 'temario_pdf_pregenerated', endpoint: '/api/admin/temario/pregenerate', metadata: { oposicion, tema: topicNumber, outcome: 'render_failed', error, ms } })
    return { oposicion, tema: topicNumber, ok: false, outcome: 'error', error, ms }
  }
}
