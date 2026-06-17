// app/auxiliar-administrativo-diputacion-huesca/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Huesca - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Huesca con tests organizados por temas. 23 temas oficiales.',
  keywords: ['test auxiliar administrativo diputación provincial de huesca', 'oposiciones diputación provincial de huesca', 'examen auxiliar huesca', 'test oposiciones C2 huesca'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Huesca - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Huesca con tests organizados por temas. 23 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-diputacion-huesca" />
}
