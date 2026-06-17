// app/auxiliar-administrativo-diputacion-segovia/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Segovia - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Segovia con tests organizados por temas. 30 temas oficiales.',
  keywords: ['test auxiliar administrativo diputación provincial de segovia', 'oposiciones diputación provincial de segovia', 'examen auxiliar segovia', 'test oposiciones C2 segovia'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Segovia - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Segovia con tests organizados por temas. 30 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-diputacion-segovia" />
}
