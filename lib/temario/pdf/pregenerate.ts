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
import { stampTopicPdfChrome } from '@/lib/temario/pdf/stampChrome'
import { INSTANCE_ID } from '@/lib/observability/instanceId'
import { topicPdfContentHash, topicPdfCacheKey, TOPIC_PDF_BUCKET } from '@/lib/temario/pdf/pdfCache'
import { S3StorageAdapter } from '@/lib/storage/s3-adapter'
import { emitFireAndForget } from '@/lib/observability/emit'
import { countContentChars, maxArticleChars, fitsSyncPdf, PDF_MAX_CHARS } from '@/lib/temario/pdf/topicPdfModel'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { planPartes } = require('@/lib/temario/pdf/planPartes.cjs') as {
  planPartes: (c: unknown, max: number) => { total: number; partes: Array<{ indice: number; total: number; etiqueta: string; laws: unknown[] }> }
}

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
  /** Nº de partes generadas cuando el tema no cabe entero (T-273). Ausente = tema de una pieza. */
  partes?: number
}

/**
 * Genera y sube CADA PARTE de un tema que no cabe entero (T-273).
 *
 * Una parte fallida NO aborta las demás: al opositor le sirve más recibir 4 de 5 partes que nada.
 * El resultado global solo es `ok` si todas salieron, para que el job no se dé por bueno a medias.
 */
async function pregenerarPartes(
  oposicion: string,
  topicNumber: number,
  content: NonNullable<Awaited<ReturnType<typeof getTopicContentUncached>>>,
  plan: { total: number; partes: Array<{ indice: number; total: number; etiqueta: string; laws: unknown[] }> },
  opts: { force?: boolean },
  started: number,
): Promise<PregenResult> {
  const storage = new S3StorageAdapter()
  const lawIds = (content.laws || []).map((l) => l.law.id).filter(Boolean)
  const sectionNames = await getLawSectionNames(lawIds)

  let bytes = 0
  let subidas = 0
  let saltadas = 0
  const fallos: string[] = []

  for (const parte of plan.partes) {
    // Copia por parte, NUNCA mutar el contenido compartido: recortar `content.laws` in situ haría
    // que la parte 2 se calculara sobre lo que dejó la 1 y las claves saldrían mal en cadena.
    const trozo = { ...content, laws: parte.laws as typeof content.laws }
    const hash = topicPdfContentHash(trozo)
    const key = topicPdfCacheKey(oposicion, topicNumber, hash)

    if (!opts.force) {
      const ya = await storage.download({ bucket: TOPIC_PDF_BUCKET, path: key }).catch(() => null)
      if (ya && ya.success) { saltadas++; bytes += ya.data.length; continue }
    }

    try {
      const model = buildTopicPdfModel(trozo, new Date(), sectionNames)
      const doc = React.createElement(TopicPdfDocument, { model }) as React.ReactElement<DocumentProps>
      const raw = await renderToBuffer(doc)
      // El estampado DEGRADA igual que en el tema entero: si falla, se sube sin chrome.
      let buffer: Buffer = raw
      try {
        const stamped = await stampTopicPdfChrome(raw, { footer: model.footer, title: model.title })
        buffer = Buffer.from(stamped.bytes)
      } catch { /* sin chrome antes que sin PDF */ }

      const up = await storage.upload({
        bucket: TOPIC_PDF_BUCKET, path: key, data: buffer, contentType: 'application/pdf',
        cacheControl: 'public, max-age=31536000, immutable',
      })
      if (!up.success) { fallos.push(`parte ${parte.indice}: upload ${up.error}`); continue }
      subidas++
      bytes += buffer.length
    } catch (e) {
      fallos.push(`parte ${parte.indice}: ${e instanceof Error ? e.message : 'desconocido'}`)
    }
  }

  const ms = Date.now() - started
  const ok = fallos.length === 0
  emitFireAndForget({
    source: 'fargate', severity: ok ? 'info' : 'warn', eventType: 'temario_pdf_pregenerated',
    endpoint: '/api/admin/temario/pregenerate',
    metadata: {
      oposicion, tema: topicNumber, outcome: ok ? (subidas ? 'uploaded' : 'skipped') : 'partes_incompletas',
      partes: plan.total, subidas, saltadas, fallos: fallos.length, bytes, ms, instanceId: INSTANCE_ID,
      ...(fallos.length ? { error: fallos.slice(0, 3).join(' | ') } : {}),
    },
  })
  return {
    oposicion, tema: topicNumber, ok,
    outcome: ok ? (subidas ? 'uploaded' : 'skipped') : 'error',
    bytes, ms, partes: plan.total,
    ...(ok ? {} : { error: fallos.slice(0, 3).join(' | ') }),
  }
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

    // ── Temas que NO caben enteros: generar sus PARTES (T-273) ────────────────────────────────
    //
    // Hasta el 30/07 esto generaba SIEMPRE el PDF entero, así que el troceado solo existía en la
    // ruta que atiende al usuario: un tema grande se partía **en la web, con el opositor
    // esperando**, que es el trabajo pesado que el 29/07 tumbó la plataforma ([T-270]).
    //
    // La clave está en generar EXACTAMENTE las mismas partes que la ruta pedirá. Por eso se usan
    // sus mismas funciones (`planPartes` con `PDF_MAX_CHARS`, y el hash sobre el contenido YA
    // recortado): si las claves no coincidieran, la ruta no encontraría nada en S3 y volvería a
    // renderizar en línea — el trabajo del worker no lo aprovecharía nadie y el defecto sería
    // invisible, porque todo "funcionaría".
    //
    // No depende del flag a propósito: pre-generar partes que aún no se sirven no molesta a nadie
    // (son objetos en S3), y así el día que se enciende ya están hechas en vez de empezar de cero.
    const chars = countContentChars(content)
    if (!fitsSyncPdf(chars, maxArticleChars(content))) {
      const plan = planPartes(content, PDF_MAX_CHARS)
      if (plan.total > 1) {
        return await pregenerarPartes(oposicion, topicNumber, content, plan, opts, started)
      }
      // total === 1 significa que no hay por dónde partirlo (un solo artículo gigante): se sigue
      // por el camino normal, que sí sabe generarlo — aquí no hay límite de 60 s del ALB.
    }

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
    // Mismo cronometraje que la ruta pública (T-270): sin la relación páginas↔ms medida, el
    // umbral de «esto no se renderiza en línea» sería un número elegido a ojo. Aquí además es
    // donde salen los temas ENORMES (487-651 páginas), que son los que calibran el extremo.
    const tRender = Date.now()
    const rawBuffer = await renderToBuffer(doc)
    const renderMs = Date.now() - tRender
    let stampMs = 0

    // Post-proceso: estampar nº de página + título del tema (pdf-lib). DEGRADA: si el estampado
    // falla, se sube el PDF sin chrome y se registra un warn — nunca romper la descarga por esto.
    let buffer: Buffer = rawBuffer
    try {
      const tStamp = Date.now()
      const stamped = await stampTopicPdfChrome(rawBuffer, { footer: model.footer, title: model.title })
      stampMs = Date.now() - tStamp
      buffer = Buffer.from(stamped.bytes)
      emitFireAndForget({ source: 'fargate', severity: 'info', eventType: 'temario_pdf_stamped', endpoint: '/api/admin/temario/pregenerate', metadata: { oposicion, tema: topicNumber, pages: stamped.pageCount, renderMs, stampMs, instanceId: INSTANCE_ID } })
    } catch (e) {
      emitFireAndForget({ source: 'fargate', severity: 'warn', eventType: 'temario_pdf_stamped', endpoint: '/api/admin/temario/pregenerate', metadata: { oposicion, tema: topicNumber, outcome: 'stamp_failed', error: e instanceof Error ? e.message : 'desconocido' } })
    }

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
