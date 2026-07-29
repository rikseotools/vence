// app/api/temario/[oposicion]/[topic]/pdf/route.ts
//
// Genera EN SERVIDOR el PDF de un tema del temario. Sustituye al window.print() del
// botón, que en iOS y en navegadores in-app (app de Google, Instagram, Facebook…) no
// descargaba nada: el botón decía "Imprimir PDF" y no producía ningún PDF. De ahí salieron
// 3 tickets de soporte en un solo día (16/07: María, Sonia, Mónica).
//
// ACCESO: pública, igual que la página del tema (la teoría está indexada en SEO y el
// "regístrate para imprimir" del botón es captación de leads, no un control de seguridad).
// No expone nada nuevo: es el mismo contenido que ya sirve /[oposicion]/temario/[slug].
// (La regla anti-scraping del proyecto protege `correct_option` de las PREGUNTAS, que aquí
// no interviene: el PDF solo lleva articulado legal.)
//
// Motor: @react-pdf/renderer (JS puro), no Chromium headless — ver TopicPdfDocument.tsx.

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import { getTopicContent, getLawSectionNames } from '@/lib/api/temario/queries'
import { OPOSICIONES, type OposicionSlug } from '@/lib/api/temario/schemas'
import { buildTopicPdfModel, pdfFileName, countContentChars, maxArticleChars, fitsSyncPdf, PDF_MAX_CHARS, PDF_MAX_ARTICLE_CHARS } from '@/lib/temario/pdf/topicPdfModel'
import { topicPdfContentHash, topicPdfCacheKey, TOPIC_PDF_BUCKET } from '@/lib/temario/pdf/pdfCache'
import { S3StorageAdapter } from '@/lib/storage/s3-adapter'
import { emitFireAndForget } from '@/lib/observability/emit'
import { TopicPdfDocument } from '@/lib/temario/pdf/TopicPdfDocument'
import { stampTopicPdfChrome } from '@/lib/temario/pdf/stampChrome'
import { INSTANCE_ID } from '@/lib/observability/instanceId'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuthOptional } from '@/lib/api/auth/verifyAuth'
import { getUserPlanType } from '@/lib/referrals/queries'
import { isPremiumPlan } from '@/lib/premium/isPremiumPlan'

export const dynamic = 'force-dynamic'
// Un tema es 21 páginas de mediana, pero la cola pesa (p95 = 178, máximo 760).
// 60 s da margen al peor caso sin dejar la request colgada indefinidamente.
export const maxDuration = 60

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ oposicion: string; topic: string }> }
) {
  const { oposicion: oposicionRaw, topic } = await params

  // El botón de imprimir (TopicPrintButton) deriva este valor del `oposicion=` del loginHref,
  // que es el POSITION_TYPE (con underscores: `administrativo_estado`), no el slug (con guiones:
  // `administrativo-estado`). Como `OPOSICIONES` se indexa por slug, sin normalizar daba 404 en
  // TODAS las oposiciones desde T-039 (el botón pasó de window.print() a este fetch). La
  // convención de Vence es slug = position_type con `_`→`-`, así que normalizamos: acepta ambos
  // (underscores del botón y guiones de un enlace directo) y un slug ya hecho es idempotente.
  const oposicion = oposicionRaw.replace(/_/g, '-')

  if (!(oposicion in OPOSICIONES)) {
    return NextResponse.json({ error: 'Oposición no encontrada' }, { status: 404 })
  }
  const topicNumber = Number(topic)
  if (!Number.isInteger(topicNumber) || topicNumber <= 0) {
    return NextResponse.json({ error: 'Número de tema inválido' }, { status: 400 })
  }

  // Gate PREMIUM (T-076): descargar el PDF del temario es Premium (TODOS los temas). El
  // botón ya muestra 👑 + modal, pero un free podría pegar a esta URL directamente →
  // defensa en profundidad (mismo patrón que /api/questions/filtered con isPremiumPlan).
  // 403 → el cliente abre el modal 👑.
  // `auth` se resuelve AQUÍ y vive hasta el final del handler a propósito: además de la puerta,
  // el actor hace falta para poder responder «quién» ante un barrido (T-270). Antes estaba en un
  // bloque y se perdía; ver la corrección del incidente en ARCHITECTURE_ROADMAP.md.
  const auth = await verifyAuthOptional(req, '/api/temario/pdf').catch(() => null)
  const userId = auth?.userId ?? null
  {
    const planType = userId ? await getUserPlanType(userId) : null
    if (!isPremiumPlan(planType)) {
      return NextResponse.json({ error: 'premium_required', feature: 'print_pdf' }, { status: 403 })
    }
  }

  const content = await getTopicContent(oposicion as OposicionSlug, topicNumber)
  if (!content) {
    return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 })
  }

  const chars = countContentChars(content)
  const maxArt = maxArticleChars(content)
  const contentHash = topicPdfContentHash(content)
  const cacheKey = topicPdfCacheKey(oposicion, topicNumber, contentHash)
  const fileName = pdfFileName(oposicion, topicNumber)
  const storage = new S3StorageAdapter()

  // Coste de CPU de ESTA petición. Se rellena solo en el camino que renderiza; en un acierto
  // de caché queda a 0, que es justo la distinción que hay que poder medir.
  //
  // Por qué se instrumenta aquí y no basta con `request_completed` (T-270, 29/07): ese evento
  // está MUESTREADO al 10% para 2xx (`SUCCESS_TIMING_SAMPLE_RATE`), así que de un incidente de
  // 18 minutos solo sobreviven un puñado de duraciones — con eso no se puede calibrar cuánto
  // bloquea realmente un render. `temario_pdf_served` NO se muestrea: se emite en cada petición.
  // Y el `instanceId` dice en QUÉ task cayó, que es lo que decide si el daño se reparte o se
  // concentra; sin él, 36 renders repartidos entre 12 tasks y 36 sobre la misma son el mismo
  // número y no el mismo incidente.
  const cpu = { renderMs: 0, stampMs: 0 }

  const emitServed = (source: 's3' | 'generated' | 'too_large', bytes: number) =>
    emitFireAndForget({
      source: 'fargate', severity: 'info', eventType: 'temario_pdf_served',
      endpoint: '/api/temario/[oposicion]/[topic]/pdf',
      metadata: {
        oposicion, tema: topicNumber, served: source, chars, maxArticleChars: maxArt, bytes,
        hash: contentHash,
        // QUIÉN. Faltaba, y su ausencia costó una conclusión falsa el 29/07: al investigar el
        // incidente se leyó `count(DISTINCT user_id) = 0` como «fueron peticiones anónimas» y se
        // llegó a escribir que la ruta era un vector de denegación de servicio abierto. No lo es
        // —tiene puerta premium— y el cero era un artefacto: el emisor nunca ponía el campo.
        // Un evento sin actor obliga a adivinar quién, y adivinar sale caro.
        userId: userId ?? null,
        renderMs: cpu.renderMs, stampMs: cpu.stampMs, cpuMs: cpu.renderMs + cpu.stampMs,
        instanceId: INSTANCE_ID,
      },
    })

  const pdfResponse = (bytes: Uint8Array, source: 's3' | 'generated') => {
    emitServed(source, bytes.length)
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        // `attachment` = descarga de verdad en iOS y navegadores in-app (no un visor inexistente).
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Pdf-Source': source, // observabilidad/debug: de dónde salió el PDF
      },
    })
  }

  // 1) CACHÉ S3 (content-addressed, ver pdfCache.ts): si existe el PDF pre-generado de ESTE
  //    contenido exacto, servirlo → instantáneo y SIN el límite de 60s del ALB. Esto es lo
  //    que hace descargables los temas GRANDES (Access/ofimática): se generan offline y se
  //    sirven de aquí. Un fallo de S3 NO rompe nada: cae al camino síncrono de abajo.
  const cached = await storage.download({ bucket: TOPIC_PDF_BUCKET, path: cacheKey }).catch(() => null)
  if (cached && cached.success) {
    return pdfResponse(new Uint8Array(cached.data), 's3')
  }

  // 2) MISS de caché → guardarraíl de tamaño. Un tema que no cabe síncrono Y no está
  //    pre-generado → 413 (el cliente cae a imprimir). DOS techos: total (PDF_MAX_CHARS) Y
  //    por-artículo (PDF_MAX_ARTICLE_CHARS) — el total no basta (caso Julen, T19 = 334k total
  //    pero un artículo-cajón de 89k que 504ea; el por-artículo lo reconvierte a 413 gracioso).
  //    Los temas grandes SE ARREGLAN pre-generándolos offline (pueblan la caché de arriba).
  if (!fitsSyncPdf(chars, maxArt)) {
    emitServed('too_large', 0)
    return NextResponse.json(
      { error: 'tema_demasiado_grande', chars, maxChars: PDF_MAX_CHARS, maxArticleChars: maxArt, maxArticle: PDF_MAX_ARTICLE_CHARS },
      { status: 413 }
    )
  }

  // 3) Generar síncrono + POBLAR la caché S3 para la próxima (best-effort: si S3 falla, se
  //    sirve igual el PDF recién hecho; nunca bloquea al usuario).
  const lawIds = (content.laws || []).map(l => l.law.id).filter(Boolean)
  const sectionNames = await getLawSectionNames(lawIds)
  const model = buildTopicPdfModel(content, new Date(), sectionNames)
  const doc = React.createElement(TopicPdfDocument, { model }) as React.ReactElement<DocumentProps>
  const tRender = Date.now()
  const rawBuffer = await renderToBuffer(doc)
  cpu.renderMs = Date.now() - tRender

  // Post-proceso: estampar nº de página + título del tema (pdf-lib). Mismo helper que el worker →
  // resultado idéntico. DEGRADA: si falla, se sirve el PDF sin chrome y se registra un warn.
  let buffer: Buffer = rawBuffer
  try {
    const tStamp = Date.now()
    const stamped = await stampTopicPdfChrome(rawBuffer, { footer: model.footer, title: model.title })
    cpu.stampMs = Date.now() - tStamp
    buffer = Buffer.from(stamped.bytes)
    // `pages` vive aquí y el coste de CPU también: juntos dan la relación páginas↔ms que hoy no
    // existe y sin la cual el umbral de «esto se encola» sería un número elegido a ojo.
    emitFireAndForget({ source: 'fargate', severity: 'info', eventType: 'temario_pdf_stamped', endpoint: '/api/temario/[oposicion]/[topic]/pdf', metadata: { oposicion, tema: topicNumber, pages: stamped.pageCount, chars, renderMs: cpu.renderMs, stampMs: cpu.stampMs, instanceId: INSTANCE_ID } })
  } catch (e) {
    emitFireAndForget({ source: 'fargate', severity: 'warn', eventType: 'temario_pdf_stamped', endpoint: '/api/temario/[oposicion]/[topic]/pdf', metadata: { oposicion, tema: topicNumber, outcome: 'stamp_failed', error: e instanceof Error ? e.message : 'desconocido' } })
  }

  void storage.upload({
    bucket: TOPIC_PDF_BUCKET, path: cacheKey, data: buffer, contentType: 'application/pdf',
    // Immutable: la clave es content-addressed, así que este objeto nunca cambia.
    cacheControl: 'public, max-age=31536000, immutable',
  }).catch(() => {})

  return pdfResponse(new Uint8Array(buffer), 'generated')
}

export const GET = withErrorLogging('/api/temario/[oposicion]/[topic]/pdf', handler as never)
