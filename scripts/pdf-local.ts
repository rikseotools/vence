// scripts/pdf-local.ts — render/pre-generación de PDFs del temario desde local.
//
// Ejecuta el MISMO pipeline que producción (@react-pdf) fuera de las tasks de serving → sirve para
// (a) verificar que el render funciona, (b) pre-generar cajones ya (render → S3), y (c) probar el
// worker de la cola end-to-end con el render real.
//
//   tsx scripts/pdf-local.ts render <oposicion> <tema>   → solo render, mide bytes (NO sube)
//   tsx scripts/pdf-local.ts full   <oposicion> <tema>   → render + sube a S3 (pregenerateTopicPdf)

import React from 'react'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import { getTopicContentBaseInternal as getTopicContentUncached, getLawSectionNames } from '@/lib/api/temario/queries'
import { buildTopicPdfModel } from '@/lib/temario/pdf/topicPdfModel'
import { TopicPdfDocument } from '@/lib/temario/pdf/TopicPdfDocument'
import { pregenerateTopicPdf } from '@/lib/temario/pdf/pregenerate'
import { esObjetivoPersonalizado } from '@/lib/oposicion/objetivoPersonalizado'

async function main() {
  const [mode, oposicionRaw, temaRaw] = process.argv.slice(2)
  // ⚠️ UNA PERSONALIZADA NO SE SLUGIFICA (T-648). El `replace` traduce el `position_type` del
  // catálogo a su slug, correcto para las 131 del registro; pero una personalizada NO tiene slug
  // —lo que llega ya ES su `position_type`— y convertirla la rompe. Es la MISMA rama que ya tienen
  // `pregenerateTopicPdf` y `getTopicContentBaseInternal`: aquí había una SEGUNDA copia de la
  // conversión, y arreglar solo la de dentro no servía de nada porque este script la aplica ANTES
  // de llamarla. Medido el 07/08 ejecutando la ruta real del worker: con el arreglo puesto en
  // `pregenerate.ts` seguía saliendo `oposicion_desconocida`, y la salida lo delataba —
  // `personalizada-f228…` con guion—. La prueba directa a la función pasaba; la ruta real no.
  const oposicion = esObjetivoPersonalizado(oposicionRaw) ? oposicionRaw : (oposicionRaw || '').replace(/_/g, '-')
  const tema = Number(temaRaw)
  if (!mode || !oposicion || !Number.isInteger(tema)) {
    console.error('uso: tsx scripts/pdf-local.ts <render|full> <oposicion> <tema>')
    process.exit(2)
  }

  const t0 = Date.now()
  if (mode === 'render') {
    const content = await getTopicContentUncached(oposicion as any, tema)
    if (!content) { console.error('❌ tema_no_encontrado'); process.exit(1) }
    const lawIds = (content.laws || []).map((l: any) => l.law.id).filter(Boolean)
    const sectionNames = await getLawSectionNames(lawIds)
    const model = buildTopicPdfModel(content, new Date(), sectionNames)
    const doc = React.createElement(TopicPdfDocument, { model }) as React.ReactElement<DocumentProps>
    const buffer = await renderToBuffer(doc)
    console.log(`✅ RENDER ok — ${oposicion} T${tema} — ${(buffer.length / 1024).toFixed(0)} KB en ${Date.now() - t0} ms (sin subir)`)
  } else if (mode === 'full') {
    const force = process.argv[5] === '1' // 4º arg: '1' fuerza regenerar; default salta lo cacheado
    const r = await pregenerateTopicPdf(oposicion, tema, { force })
    console.log(`${r.ok ? '✅' : '❌'} FULL — ${oposicion} T${tema} — outcome=${r.outcome} bytes=${r.bytes ?? '-'} ms=${r.ms ?? (Date.now() - t0)} ${r.error ? 'error=' + r.error : ''}`)
    if (!r.ok) process.exit(1)
  } else {
    console.error('modo desconocido:', mode); process.exit(2)
  }
  process.exit(0)
}

main().catch((e) => { console.error('💥', e); process.exit(1) })
