// app/ordenanza-ayuntamiento-cordoba/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Ordenanza del Ayuntamiento de Córdoba - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Ordenanza del Ayuntamiento de Córdoba con tests organizados por temas. 20 temas en 2 bloques: Materias Comunes y Materias Específicas.',
  keywords: ['test auxiliar administrativo ayuntamiento cordoba', 'oposiciones ayuntamiento cordoba', 'examen auxiliar cordoba', 'test oposiciones C2 cordoba'],
  openGraph: {
    title: 'Tests Ordenanza del Ayuntamiento de Córdoba - Practica por Temas',
    description: 'Prepara tu oposición de Ordenanza del Ayuntamiento de Córdoba con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAyuntamientoCórdobaPage() {
  return <TestHubPage oposicion="ordenanza-ayuntamiento-cordoba" />
}
