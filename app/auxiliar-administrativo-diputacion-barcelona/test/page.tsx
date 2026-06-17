// app/auxiliar-administrativo-diputacion-barcelona/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación de Barcelona - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación de Barcelona con tests organizados por temas. 20 temas oficiales.',
  keywords: ['test auxiliar administrativo diputación de barcelona', 'oposiciones diputación de barcelona', 'examen auxiliar barcelona', 'test oposiciones C2 barcelona'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación de Barcelona - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación de Barcelona con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-diputacion-barcelona" />
}
