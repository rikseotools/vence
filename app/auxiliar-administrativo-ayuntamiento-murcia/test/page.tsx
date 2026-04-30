// app/auxiliar-administrativo-ayuntamiento-murcia/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Ayuntamiento de Murcia - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Murcia con tests organizados por temas. 20 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo ayuntamiento murcia', 'oposiciones ayuntamiento murcia', 'examen auxiliar murcia', 'test oposiciones C2 murcia'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Ayuntamiento de Murcia - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Murcia con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAyuntamientoMurciaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-murcia" />
}
