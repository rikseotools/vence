// app/auxiliar-administrativo-diputacion-leon/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Diputación Provincial de León - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de León con tests organizados por temas. 25 temas en 3 bloques: Derecho Constitucional, Derecho Administrativo y Administración Local.',
  keywords: ['test auxiliar administrativo diputacion leon', 'oposiciones diputacion leon', 'examen auxiliar leon', 'test oposiciones C2 leon'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Diputación Provincial de León - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de León con tests organizados por temas. 25 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionLeónPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-diputacion-leon" />
}
