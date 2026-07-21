// lib/temario/pdf/TopicPdfDocument.tsx — maquetación del PDF de un tema del temario.
//
// Se usa @react-pdf/renderer (JS puro) y NO Chromium headless a propósito: el contenido es
// texto legal (encabezados + párrafos + alguna tabla), no un layout complejo, así que no
// compensa meter ~300 MB de navegador en la imagen de ECS ni pagar su arranque en frío. Además
// la salida es determinista, sin deriva entre versiones de navegador.
//
// El contenido va en markdown (igual que la web, que lo pinta con react-markdown): se parsea a
// bloques en topicPdfModel/markdownBlocks y aquí se maqueta cada tipo (párrafo con negrita/
// cursiva, cabecera, lista y tabla con bordes).

import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { TopicPdfModel, MdBlock, MdSpan } from './topicPdfModel'

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 52, fontSize: 10.5, lineHeight: 1.5, fontFamily: 'Helvetica', color: '#111827' },
  header: { marginBottom: 18, borderBottomWidth: 1, borderBottomColor: '#c7d2fe', paddingBottom: 10 },
  oposicion: { fontSize: 9, color: '#4f46e5', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#4b5563' },
  lawName: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 4, color: '#3730a3' },
  titulo: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1e3a8a', marginTop: 13, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: '#c7d2fe', paddingBottom: 3 },
  capitulo: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#4338ca', marginTop: 9, marginBottom: 4 },
  seccion: { fontSize: 9.5, fontFamily: 'Helvetica-Oblique', color: '#4f46e5', marginTop: 6, marginBottom: 3 },
  articleBlock: { marginBottom: 11 },
  articleHeading: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  paragraph: { marginBottom: 3, textAlign: 'justify' },
  // markdown dentro del cuerpo del artículo
  mdHeading: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: '#374151', marginTop: 4, marginBottom: 3 },
  listItem: { flexDirection: 'row', marginBottom: 2 },
  listBullet: { width: 12 },
  listText: { flex: 1, textAlign: 'justify' },
  // tabla — celdas como View (patrón robusto de @react-pdf: View con borde/padding envuelve el Text)
  table: { marginTop: 4, marginBottom: 6, borderWidth: 0.5, borderColor: '#cbd5e1', borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow: { flexDirection: 'row' },
  tableCell: { flex: 1, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#cbd5e1', padding: 3 },
  tableHeadCell: { flex: 1, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#cbd5e1', padding: 3, backgroundColor: '#eef2ff' },
  tableCellText: { fontSize: 9 },
  tableHeadText: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  footer: { fontSize: 8, color: '#6b7280', textAlign: 'center', marginTop: 4 },
  empty: { fontSize: 11, color: '#6b7280', marginTop: 24 },
})

const HEADING_STYLE = { titulo: styles.titulo, capitulo: styles.capitulo, seccion: styles.seccion } as const

// Renderiza spans inline (negrita/cursiva/código) como <Text> anidados dentro de un <Text>.
function Spans({ spans }: { spans: MdSpan[] }) {
  return (
    <>
      {spans.map((s, i) => {
        const font = s.bold && s.italic ? 'Helvetica-BoldOblique'
          : s.bold ? 'Helvetica-Bold'
          : s.italic ? 'Helvetica-Oblique'
          : s.code ? 'Courier'
          : 'Helvetica'
        return <Text key={i} style={{ fontFamily: font }}>{s.text}</Text>
      })}
    </>
  )
}

function MdBlockView({ block }: { block: MdBlock }) {
  if (block.kind === 'paragraph') {
    return <Text style={styles.paragraph}><Spans spans={block.spans} /></Text>
  }
  if (block.kind === 'heading') {
    return <Text style={styles.mdHeading}><Spans spans={block.spans} /></Text>
  }
  if (block.kind === 'list') {
    return (
      <View>
        {block.items.map((item, i) => (
          <View key={i} style={styles.listItem} wrap={false}>
            <Text style={styles.listBullet}>{block.ordered ? `${i + 1}.` : '•'}</Text>
            <Text style={styles.listText}><Spans spans={item} /></Text>
          </View>
        ))}
      </View>
    )
  }
  // tabla
  return (
    <View style={styles.table}>
      {block.header.length > 0 && (
        <View style={styles.tableRow} wrap={false}>
          {block.header.map((cell, c) => (
            <View key={c} style={styles.tableHeadCell}>
              <Text style={styles.tableHeadText}><Spans spans={cell} /></Text>
            </View>
          ))}
        </View>
      )}
      {block.rows.map((row, r) => (
        <View key={r} style={styles.tableRow} wrap={false}>
          {row.map((cell, c) => (
            <View key={c} style={styles.tableCell}>
              <Text style={styles.tableCellText}><Spans spans={cell} /></Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

export function TopicPdfDocument({ model }: { model: TopicPdfModel }) {
  return (
    <Document
      title={model.title}
      author="Vence"
      subject={model.oposicionName}
      creator="Vence"
      producer="Vence"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.oposicion}>{model.oposicionName}</Text>
          <Text style={styles.title}>{model.title}</Text>
          {model.subtitle ? <Text style={styles.subtitle}>{model.subtitle}</Text> : null}
        </View>

        {model.sections.length === 0 ? (
          <Text style={styles.empty}>Este tema todavía no tiene contenido publicado.</Text>
        ) : (
          model.sections.map((section, i) => (
            <View key={i}>
              <Text style={styles.lawName}>{section.lawName}</Text>
              {section.blocks.map((block, b) =>
                block.kind === 'heading' ? (
                  <View key={b} wrap={false}>
                    <Text style={HEADING_STYLE[block.level]}>{block.text}</Text>
                  </View>
                ) : (
                  <View key={b} style={styles.articleBlock} wrap={true}>
                    <Text style={styles.articleHeading}>{block.heading}</Text>
                    {block.body.map((mb, k) => (
                      <MdBlockView key={k} block={mb} />
                    ))}
                  </View>
                )
              )}
            </View>
          ))
        )}

        {/* Pie repetido en cada página. SIN position:absolute a propósito: con `position:absolute` el
            motor de maquetación desbordaba ("unsupported number") en temas de +20 artículos. */}
        <View style={styles.footer} fixed>
          <Text>{model.footer}</Text>
        </View>
      </Page>
    </Document>
  )
}
