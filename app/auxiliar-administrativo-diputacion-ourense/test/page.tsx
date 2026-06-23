// app/auxiliar-administrativo-diputacion-ourense/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Ourense - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Ourense con tests organizados por temas. 20 temas oficiales.',
  keywords: ['test auxiliar administrativo diputación provincial de ourense', 'oposiciones diputación provincial de ourense', 'examen auxiliar ourense', 'test oposiciones C2 ourense'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Ourense - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Ourense con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAdministrativoDiputacionOurensePage() {
  return <TestHubPage oposicion="auxiliar-administrativo-diputacion-ourense" />
}
