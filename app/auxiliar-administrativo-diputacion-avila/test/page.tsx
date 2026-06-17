// app/auxiliar-administrativo-diputacion-avila/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Ávila - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Ávila con tests organizados por temas. 30 temas en 2 bloques: materia común y materia específica.',
  keywords: ['test auxiliar administrativo diputacion avila', 'oposiciones diputacion avila', 'examen auxiliar avila', 'test oposiciones C2 avila'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Ávila - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Ávila con tests organizados por temas. 30 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionÁvilaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-diputacion-avila" />
}
