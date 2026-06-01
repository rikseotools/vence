// app/auxiliar-administrativo-ayuntamiento-badajoz/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Ayuntamiento de Badajoz - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Badajoz con tests organizados por temas. 20 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo ayuntamiento badajoz', 'oposiciones ayuntamiento badajoz', 'examen auxiliar badajoz', 'test oposiciones C2 badajoz'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Ayuntamiento de Badajoz - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Badajoz con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAyuntamientoBadajozPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-badajoz" />
}
