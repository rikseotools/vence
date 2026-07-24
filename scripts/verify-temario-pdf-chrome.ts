// scripts/verify-temario-pdf-chrome.ts
//
// Verificación VISUAL del chrome del PDF del temario (nº de página + título del tema por hoja +
// que no haya cabeceras huérfanas). Renderiza un tema REAL por el pipeline de producción
// (render @react-pdf → stampChrome pdf-lib) y vuelca el PDF a disco para inspección por imagen.
//
// Necesita BD (getTopicContent) y, para ver las imágenes, poppler (pdftoppm/pdftotext).
//
// Uso:
//   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx -r dotenv/config -r tsconfig-paths/register \
//     scripts/verify-temario-pdf-chrome.ts <oposicion-slug> <tema> [out.pdf]
//   # dotenv/config carga .env (o usa DOTENV_CONFIG_PATH=.env.local)
//   pdftotext out.pdf - | grep -oE 'Página [0-9]+ de [0-9]+'    # nº de página en cada hoja
//   pdftoppm -f 2 -l 2 -r 110 -png out.pdf pag2                 # inspeccionar la hoja 2
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import fs from 'fs'
import { getTopicContent, getLawSectionNames } from '@/lib/api/temario/queries'
import { type OposicionSlug } from '@/lib/api/temario/schemas'
import { buildTopicPdfModel } from '@/lib/temario/pdf/topicPdfModel'
import { TopicPdfDocument } from '@/lib/temario/pdf/TopicPdfDocument'
import { stampTopicPdfChrome } from '@/lib/temario/pdf/stampChrome'

;(async () => {
  const [oposicion, temaRaw, outArg] = process.argv.slice(2)
  const tema = Number(temaRaw)
  if (!oposicion || !Number.isInteger(tema)) {
    console.error('Uso: verify-temario-pdf-chrome.ts <oposicion-slug> <tema> [out.pdf]')
    process.exit(2)
  }
  const content = await getTopicContent(oposicion as OposicionSlug, tema)
  if (!content) { console.error('tema_no_encontrado'); process.exit(1) }
  const lawIds = (content.laws || []).map((l) => l.law.id).filter(Boolean)
  const sectionNames = await getLawSectionNames(lawIds)
  const model = buildTopicPdfModel(content, new Date(), sectionNames)
  const doc = React.createElement(TopicPdfDocument, { model }) as React.ReactElement<DocumentProps>
  const raw = await renderToBuffer(doc)
  const { bytes, pageCount } = await stampTopicPdfChrome(raw, { footer: model.footer, title: model.title })
  const out = outArg || `/tmp/${oposicion}-T${tema}.pdf`
  fs.writeFileSync(out, Buffer.from(bytes))
  console.log(`OK ${oposicion} T${tema}: ${pageCount} págs, ${bytes.length} bytes → ${out}`)
  console.log(`   verifica: pdftotext ${out} - | grep -oE 'Página [0-9]+ de [0-9]+' | sort -u`)
  process.exit(0)
})()
