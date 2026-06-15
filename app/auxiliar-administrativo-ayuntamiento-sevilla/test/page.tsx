// app/auxiliar-administrativo-ayuntamiento-sevilla/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo del Ayuntamiento de Sevilla - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Sevilla con tests organizados por temas. 26 temas en 2 bloques: organización pública/Derecho administrativo y ofimática.',
  keywords: ['test auxiliar administrativo ayuntamiento sevilla', 'oposiciones ayuntamiento sevilla', 'examen auxiliar sevilla', 'test oposiciones C2 sevilla'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo del Ayuntamiento de Sevilla - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Sevilla con tests organizados por temas. 26 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAytoSevillaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-sevilla" />
}
