// app/auxiliar-administrativo-ayuntamiento-madrid/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Madrid - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Ayuntamiento de Madrid con tests organizados por temas. 22 temas en 2 bloques: Materias Comunes y Materias Específicas.',
  keywords: ['test auxiliar administrativo ayuntamiento madrid', 'oposiciones ayuntamiento madrid', 'examen auxiliar madrid', 'test oposiciones C2 madrid'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Madrid - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Ayuntamiento de Madrid con tests organizados por temas. 22 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-madrid" />
}
