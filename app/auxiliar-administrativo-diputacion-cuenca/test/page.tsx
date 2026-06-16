// app/auxiliar-administrativo-diputacion-cuenca/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Cuenca - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Cuenca con tests organizados por temas. 20 temas en 2 bloques: materia común y materia específica.',
  keywords: ['test auxiliar administrativo diputacion cuenca', 'oposiciones diputacion cuenca', 'examen auxiliar cuenca', 'test oposiciones C2 cuenca'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Cuenca - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Cuenca con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionCuencaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-diputacion-cuenca" />
}
