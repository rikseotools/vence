// app/auxiliar-administrativo-ayuntamiento-alcala-henares/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Alcalá de Henares - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Ayuntamiento de Alcalá de Henares con tests organizados por temas. 24 temas oficiales.',
  keywords: ['test auxiliar administrativo ayuntamiento de alcalá de henares', 'oposiciones ayuntamiento de alcalá de henares', 'examen auxiliar alcala-henares', 'test oposiciones C2 alcala-henares'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Alcalá de Henares - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Ayuntamiento de Alcalá de Henares con tests organizados por temas. 24 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-alcala-henares" />
}
