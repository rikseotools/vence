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
import { getTopicContent } from '@/lib/api/temario/queries'
import { OPOSICIONES, type OposicionSlug } from '@/lib/api/temario/schemas'
import { buildTopicPdfModel, pdfFileName, countContentChars, fitsSyncPdf, PDF_MAX_CHARS } from '@/lib/temario/pdf/topicPdfModel'
import { TopicPdfDocument } from '@/lib/temario/pdf/TopicPdfDocument'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
// Un tema es 21 páginas de mediana, pero la cola pesa (p95 = 178, máximo 760).
// 60 s da margen al peor caso sin dejar la request colgada indefinidamente.
export const maxDuration = 60

async function handler(
  _req: NextRequest,
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

  const content = await getTopicContent(oposicion as OposicionSlug, topicNumber)
  if (!content) {
    return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 })
  }

  // Guardarraíl de tamaño: los "artículos-cajón" (T-040) meten una app entera en un solo
  // artículo y el render no baja de minutos → timeout garantizado. Mejor decirlo claro y
  // que el cliente degrade a la impresión del navegador (lo que había antes).
  const chars = countContentChars(content)
  if (!fitsSyncPdf(chars)) {
    return NextResponse.json(
      { error: 'tema_demasiado_grande', chars, maxChars: PDF_MAX_CHARS },
      { status: 413 }
    )
  }

  const model = buildTopicPdfModel(content, new Date())
  const doc = React.createElement(TopicPdfDocument, { model }) as React.ReactElement<DocumentProps>
  const buffer = await renderToBuffer(doc)
  const fileName = pdfFileName(oposicion, topicNumber)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      // `attachment` es lo que hace que descargue de verdad en iOS y en navegadores
      // in-app, en vez de intentar abrir un visor que allí no existe.
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(buffer.length),
      // El articulado cambia poco; una hora de cache alivia el render sin servir texto viejo.
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}

export const GET = withErrorLogging('/api/temario/[oposicion]/[topic]/pdf', handler as never)
