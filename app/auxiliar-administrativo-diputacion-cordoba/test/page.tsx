// app/auxiliar-administrativo-diputacion-cordoba/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Córdoba - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Córdoba con tests organizados por temas. 20 temas en 2 bloques: Materias Comunes y Materias Específicas.',
  keywords: ['test auxiliar administrativo diputacion cordoba', 'oposiciones diputacion cordoba', 'examen auxiliar cordoba', 'test oposiciones C2 cordoba'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Córdoba - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Córdoba con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionCórdobaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-diputacion-cordoba" />
}
