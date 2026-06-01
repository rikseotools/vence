// app/auxiliar-administrativo-ayuntamiento-zaragoza/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Ayuntamiento de Zaragoza - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Zaragoza con tests organizados por temas. 25 temas en 3 bloques: Organización Jurídica, Administración Local y Ofimática.',
  keywords: ['test auxiliar administrativo ayuntamiento zaragoza', 'oposiciones ayuntamiento zaragoza', 'examen auxiliar zaragoza', 'test oposiciones C2 zaragoza'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Ayuntamiento de Zaragoza - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Zaragoza con tests organizados por temas. 25 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAyuntamientoZaragozaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-zaragoza" />
}
