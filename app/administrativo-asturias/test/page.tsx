import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo Principado de Asturias - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Administrativo Principado de Asturias con tests organizados por temas. 38 temas en 5 partes.',
  keywords: ['test administrativo asturias', 'oposiciones principado de asturias', 'examen administrativo asturias', 'test oposiciones C1 asturias'],
  openGraph: {
    title: 'Tests Administrativo Principado de Asturias - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 38 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAdministrativoAsturiasPage() {
  return <TestHubPage oposicion="administrativo-asturias" />
}
