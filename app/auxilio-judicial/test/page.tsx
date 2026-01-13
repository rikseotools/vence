// app/auxilio-judicial/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxilio Judicial - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxilio Judicial con tests organizados por temas. 26 temas en 3 bloques: Derecho Constitucional, Organizacion Judicial y Procedimientos.',
  keywords: ['test auxilio judicial', 'oposiciones justicia', 'examen auxilio judicial', 'test oposiciones C2'],
  openGraph: {
    title: 'Tests Auxilio Judicial - Practica por Temas',
    description: 'Prepara tu oposicion de Auxilio Judicial con tests organizados por temas. 26 temas oficiales BOE 2025.',
    type: 'website',
  },
}

export default function TestsAuxilioJudicialPage() {
  return <TestHubPage oposicion="auxilio-judicial" />
}
