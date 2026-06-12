import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo Gobierno Vasco - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Administrativo del Gobierno Vasco con tests organizados por temas. 34 temas en 1 bloque.',
  keywords: ['test administrativo pais-vasco', 'oposiciones gobierno pais-vasco', 'examen administrativo pais-vasco', 'test oposiciones C1 pais-vasco'],
  openGraph: {
    title: 'Tests Administrativo Gobierno Vasco - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 34 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAdministrativoPaisVascoPage() {
  return <TestHubPage oposicion="administrativo-pais-vasco" />
}
