import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo del Servicio Canario de la Salud (SCS) - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo del Servicio Canario de la Salud (SCS) con tests organizados por temas. 22 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo canarias', 'oposiciones gobierno canarias', 'examen auxiliar canarias', 'test oposiciones C2 canarias'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo del Servicio Canario de la Salud (SCS) - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 22 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarCanariasPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-scs-canarias" />
}
