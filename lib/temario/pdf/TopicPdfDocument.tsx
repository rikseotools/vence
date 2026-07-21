// lib/temario/pdf/TopicPdfDocument.tsx — maquetación del PDF de un tema del temario.
//
// Se usa @react-pdf/renderer (JS puro) y NO Chromium headless a propósito: el contenido es
// texto legal (encabezados + párrafos), no un layout complejo, así que no compensa meter
// ~300 MB de navegador en la imagen de ECS ni pagar su arranque en frío. Además la salida
// es determinista, sin deriva entre versiones de navegador.

import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { TopicPdfModel } from './topicPdfModel'

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 56, paddingHorizontal: 52, fontSize: 10.5, lineHeight: 1.5, fontFamily: 'Helvetica', color: '#111827' },
  header: { marginBottom: 18, borderBottomWidth: 1, borderBottomColor: '#c7d2fe', paddingBottom: 10 },
  oposicion: { fontSize: 9, color: '#4f46e5', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 17, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#4b5563' },
  // Nombre de la ley: cabecera de primer nivel.
  lawName: { fontSize: 12.5, fontFamily: 'Helvetica-Bold', marginTop: 18, marginBottom: 4, color: '#3730a3' },
  // Estructura de la ley (Título / Capítulo / Sección), cada una con su peso visual.
  titulo: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#1e3a8a', marginTop: 13, marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: '#c7d2fe', paddingBottom: 3 },
  capitulo: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#4338ca', marginTop: 9, marginBottom: 4 },
  seccion: { fontSize: 9.5, fontFamily: 'Helvetica-Oblique', color: '#4f46e5', marginTop: 6, marginBottom: 3 },
  articleBlock: { marginBottom: 11 },
  articleHeading: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  paragraph: { marginBottom: 3, textAlign: 'justify' },
  footer: { fontSize: 8, color: '#6b7280', textAlign: 'center', marginTop: 4 },
  empty: { fontSize: 11, color: '#6b7280', marginTop: 24 },
})

const HEADING_STYLE = { titulo: styles.titulo, capitulo: styles.capitulo, seccion: styles.seccion } as const

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
              {/* Nombre de la ley. Se deja fluir (wrap): con leyes largas, `wrap={false}` provoca
                  saltos de página enormes. */}
              <Text style={styles.lawName}>{section.lawName}</Text>
              {section.blocks.map((block, b) =>
                block.kind === 'heading' ? (
                  // Cabecera de estructura (Título/Capítulo/Sección). `wrap={false}` evita que una
                  // cabecera quede huérfana al pie de página separada de su primer artículo.
                  <View key={b} wrap={false}>
                    <Text style={HEADING_STYLE[block.level]}>{block.text}</Text>
                  </View>
                ) : (
                  <View key={b} style={styles.articleBlock} wrap={true}>
                    <Text style={styles.articleHeading}>{block.heading}</Text>
                    {block.paragraphs.map((p, k) => (
                      <Text key={k} style={styles.paragraph}>{p}</Text>
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
