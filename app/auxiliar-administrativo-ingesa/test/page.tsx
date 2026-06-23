import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo del INGESA (Ceuta y Melilla) - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo del INGESA (Ceuta y Melilla) con tests organizados por temas. 35 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo ingesa', 'oposiciones ingesa ceuta melilla', 'examen auxiliar administrativo ingesa', 'test oposiciones C2 ingesa'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo del INGESA (Ceuta y Melilla) - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 35 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAdministrativoIngesaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ingesa" />
}
