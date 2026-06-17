// app/auxiliar-administrativo-ayuntamiento-granada/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Granada - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Ayuntamiento de Granada con tests organizados por temas. 22 temas oficiales.',
  keywords: ['test auxiliar administrativo ayuntamiento de granada', 'oposiciones ayuntamiento de granada', 'examen auxiliar granada', 'test oposiciones C2 granada'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Ayuntamiento de Granada - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Ayuntamiento de Granada con tests organizados por temas. 22 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-granada" />
}
