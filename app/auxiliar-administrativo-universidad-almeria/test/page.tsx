// app/auxiliar-administrativo-universidad-almeria/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Universidad de Almería - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad de Almería con tests organizados por temas. 17 temas oficiales.',
  keywords: ['test auxiliar administrativo universidad de almeria', 'oposiciones universidad de almeria', 'examen auxiliar almeria', 'test oposiciones C2 almeria'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Universidad de Almería - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad de Almería con tests organizados por temas. 17 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAdministrativoUniversidadAlmeriaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-universidad-almeria" />
}
