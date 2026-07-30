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
import { getRenderSemaphore, waitMsFromEnv } from '@/lib/temario/pdf/renderSemaphore'
import { S3StorageAdapter } from '@/lib/storage/s3-adapter'
import { emitFireAndForget } from '@/lib/observability/emit'
import { TopicPdfDocument } from '@/lib/temario/pdf/TopicPdfDocument'
import { stampTopicPdfChrome } from '@/lib/temario/pdf/stampChrome'
import { INSTANCE_ID } from '@/lib/observability/instanceId'
import { isPdfPartesEnabledFor } from '@/lib/temario/pdf/flagPartes'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { planPartes } = require('@/lib/temario/pdf/planPartes.cjs') as {
  planPartes: (c: unknown, max: number) => { total: number; partes: Array<{ indice: number; total: number; etiqueta: string; chars: number; laws: unknown[] }> }
}
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuthOptional } from '@/lib/api/auth/verifyAuth'
import { getUserPlanType } from '@/lib/referrals/queries'
import { isPremiumPlan } from '@/lib/premium/isPremiumPlan'

export const dynamic = 'force-dynamic'
// Un tema es 21 páginas de mediana, pero la cola pesa (p95 = 178, máximo 760).
// 60 s da margen al peor caso sin dejar la request colgada indefinidamente.
export const maxDuration = 60

/**
 * Encola un tema que no cabe entero, para que el worker lo deje troceado en S3 (T-273).
 *
 * Fire-and-forget deliberado: **nunca** debe hacer esperar ni romper la respuesta del usuario. Si
 * la cola no está disponible, se registra y ya está — el opositor recibe lo mismo que recibía.
 * Deduplicado por `content_hash` en la propia tabla (`ON CONFLICT DO NOTHING`), así que N usuarios
 * pidiendo el mismo tema generan UN trabajo, no N.
 */
function encolarParaElWorker(
  oposicion: string,
  tema: number,
  contentHash: string,
  chars: number,
  userId: string | null,
): void {
  void (async () => {
    try {
      const { getDb } = await import('@/db/client')
      const { enqueuePdfJob } = await import('@/lib/temario/pdf/pdfJobQueue')
      const nuevo = await enqueuePdfJob(getDb() as unknown as { execute: (q: unknown) => Promise<unknown> }, {
        oposicion, tema, contentHash,
      })
      emitFireAndForget({
        source: 'fargate', severity: 'info', eventType: 'temario_pdf_encolado_por_usuario',
        endpoint: '/api/temario/[oposicion]/[topic]/pdf',
        // `nuevo:false` NO es un fallo: significa que ya estaba encolado. Distinguirlo importa para
        // saber si un tema se pide muchas veces y el worker no llega, que es la señal de T-159.
        metadata: { oposicion, tema, chars, nuevo, userId, hash: contentHash, instanceId: INSTANCE_ID },
      })
    } catch (e) {
      emitFireAndForget({
        source: 'fargate', severity: 'warn', eventType: 'temario_pdf_encolado_por_usuario',
        endpoint: '/api/temario/[oposicion]/[topic]/pdf',
        metadata: { oposicion, tema, outcome: 'enqueue_failed', error: e instanceof Error ? e.message : 'desconocido' },
      })
    }
  })()
}

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

  // ── PARTE concreta (piloto T-273) ──────────────────────────────────────────────────────────
  // Se recorta el contenido AQUÍ, ANTES del hash, y eso no es casual: la caché es
  // content-addressed, así que cada parte queda cacheada por el hash de SU propio contenido. Un
  // cambio dentro de un bloque invalida solo la parte que lo contiene, no el tema entero — que es
  // justo lo que se pierde si se parte por páginas.
  // `new URL(req.url)` y no `req.nextUrl`: es la forma dominante del repo (108 usos frente a 22),
  // es API web estándar y no ata la ruta a las particularidades de NextRequest.
  const parteParam = new URL(req.url).searchParams.get('parte')
  let parteInfo: { indice: number; total: number; etiqueta: string } | null = null
  if (parteParam && isPdfPartesEnabledFor(oposicion)) {
    const n = Number(parteParam)
    const plan = planPartes(content, PDF_MAX_CHARS)
    const elegida = Number.isInteger(n) ? plan.partes.find((p) => p.indice === n) : undefined
    if (!elegida) {
      // Pedir una parte que no existe es un error del cliente, no un tema roto: se dice cuántas hay.
      return NextResponse.json(
        { error: 'parte_inexistente', parte: parteParam, partesDisponibles: plan.total },
        { status: 404 },
      )
    }
    content.laws = elegida.laws as typeof content.laws
    parteInfo = { indice: elegida.indice, total: elegida.total, etiqueta: elegida.etiqueta }
  }

  const chars = countContentChars(content)
  const maxArt = maxArticleChars(content)
  const contentHash = topicPdfContentHash(content)
  const cacheKey = topicPdfCacheKey(oposicion, topicNumber, contentHash)
  const fileName = parteInfo
    ? pdfFileName(oposicion, topicNumber).replace(/\.pdf$/i, `-parte-${parteInfo.indice}-de-${parteInfo.total}.pdf`)
    : pdfFileName(oposicion, topicNumber)
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
        parte: parteInfo ? `${parteInfo.indice}/${parteInfo.total}` : null,
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
    // AUTO-CURACIÓN (T-273/T-159): encolar el tema para que el worker lo prepare.
    //
    // Hasta el 30/07 este camino devolvía el error y ahí moría. Era **la única señal de que un
    // premium REAL quería ESE tema concreto** —la cola solo se alimentaba del hook de scope, que es
    // ciego y masivo, y de barridos a mano— y se tiraba a la basura. Medido: 5 rechazos en 30 días
    // que nadie convirtió en trabajo.
    //
    // Va SIN await: encolar es para la PRÓXIMA visita, no para ésta, así que hacer esperar al
    // usuario por ello sería cobrarle el arreglo de otro. Y si la cola falla, el usuario recibe
    // exactamente lo que recibía antes: la observabilidad no puede degradar la respuesta.
    //
    // Solo tiene sentido porque YA existe consumidor automático (`vence-temario-pdf-worker`, cada
    // 30 min) y porque ese worker ya sabe trocear. Antes de las dos cosas, encolar era escribir en
    // una cola que nadie vaciaba.
    encolarParaElWorker(oposicion, topicNumber, contentHash, chars, userId)
    // PILOTO (T-273): en vez de dejar al opositor sin nada, ofrecerle el tema TROCEADO por
    // estructura. Se aplica SOLO aquí —en el camino que hoy devuelve 413— así que no puede
    // empeorar ninguna descarga que funcione: quien recibe su PDF lo sigue recibiendo idéntico.
    // Medido: 5 rechazos en 30 días, todos de auxiliar-administrativo-estado T109 (485.084 chars).
    // Flag OFF por defecto; revertir es apagarlo, sin redeploy.
    if (isPdfPartesEnabledFor(oposicion)) {
      const plan = planPartes(content, PDF_MAX_CHARS)
      if (plan.total > 1) {
        emitFireAndForget({
          source: 'fargate', severity: 'info', eventType: 'temario_pdf_partes_ofrecidas',
          endpoint: '/api/temario/[oposicion]/[topic]/pdf',
          metadata: { oposicion, tema: topicNumber, chars, partes: plan.total, userId, instanceId: INSTANCE_ID },
        })
        return NextResponse.json({
          estado: 'disponible_por_partes',
          tema: topicNumber,
          chars,
          // El tamaño se dice SIEMPRE, no solo aquí: enseñarlo únicamente cuando el tema es enorme
          // convierte un dato útil en una disculpa (ver la ficha).
          partes: plan.partes.map((p) => ({
            parte: p.indice,
            total: p.total,
            etiqueta: p.etiqueta,
            url: `/api/temario/${oposicion}/${topicNumber}/pdf?parte=${p.indice}`,
          })),
        }, { status: 200 })
      }
    }
    emitServed('too_large', 0)
    return NextResponse.json(
      { error: 'tema_demasiado_grande', chars, maxChars: PDF_MAX_CHARS, maxArticleChars: maxArt, maxArticle: PDF_MAX_ARTICLE_CHARS },
      { status: 413 }
    )
  }

  // 2.bis) CONTENCIÓN (T-270 Fase 1): un render cuesta 7,2 s de CPU MEDIDOS y Node es monohilo,
  //    así que dos a la vez no van en paralelo: se entrelazan y duplican el tiempo que TODOS los
  //    demás usuarios esperan. El 29/07 llegaron 36 renders frescos en 18 min y el resultado fue
  //    el bucle de eventos bloqueado 215 s, `answer-and-save` a p95 25 s y 59 respuestas de
  //    usuarios sin guardar. Se espera un rato acotado a que la task se libere y, si no, se
  //    SUELTA CARGA: mejor que este PDF pida reintento a que se caiga el guardado de respuestas
  //    de todo el mundo. Desaparece con la Fase 2 (encolar + servir de S3).
  const sem = getRenderSemaphore()
  const tEspera = Date.now()
  const slot = await sem.acquire(waitMsFromEnv())
  const esperaMs = Date.now() - tEspera
  if (!slot) {
    emitFireAndForget({
      source: 'fargate', severity: 'warn', eventType: 'temario_pdf_render_shed',
      endpoint: '/api/temario/[oposicion]/[topic]/pdf',
      metadata: {
        oposicion, tema: topicNumber, chars, userId, instanceId: INSTANCE_ID,
        enVuelo: sem.inFlight(), techo: sem.max(), esperaMs,
      },
    })
    return NextResponse.json(
      { error: 'pdf_en_preparacion', reintentarEnSegundos: 30 },
      { status: 503, headers: { 'Retry-After': '30' } },
    )
  }

  try {

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

  } finally {
    // El slot se devuelve SIEMPRE: un error a medio render que se quedara el slot dejaría la
    // task sin poder generar ni un PDF más hasta el siguiente despliegue.
    slot.release()
  }
}

export const GET = withErrorLogging('/api/temario/[oposicion]/[topic]/pdf', handler as never)
