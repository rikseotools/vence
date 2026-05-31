import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Generalitat de Catalunya - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo del Generalitat de Catalunya con tests organizados por temas. 15 temas en 1 bloque.',
  keywords: ['test auxiliar administrativo catalunya', 'oposiciones gobierno catalunya', 'examen auxiliar catalunya', 'test oposiciones C2 catalunya'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Generalitat de Catalunya - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 15 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarCatalunyaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-catalunya" />
}
