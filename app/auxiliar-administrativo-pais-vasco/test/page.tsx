import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Gobierno Vasco - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo del Gobierno Vasco con tests organizados por temas. 13 temas en 1 bloque.',
  keywords: ['test auxiliar administrativo pais-vasco', 'oposiciones gobierno pais-vasco', 'examen auxiliar pais-vasco', 'test oposiciones C2 pais-vasco'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Gobierno Vasco - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 13 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarPaisVascoPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-pais-vasco" />
}
