// app/auxiliar-administrativo-diputacion-alicante/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Alicante - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Alicante con tests organizados por temas. 20 temas en 2 bloques: materias jurídico-administrativas y ofimática.',
  keywords: ['test auxiliar administrativo diputacion alicante', 'oposiciones diputacion alicante', 'examen auxiliar alicante', 'test oposiciones C2 alicante'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Alicante - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Alicante con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionAlicantePage() {
  return <TestHubPage oposicion="auxiliar-administrativo-diputacion-alicante" />
}
