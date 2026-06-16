// app/auxiliar-administrativo-universidad-cadiz/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Universidad de Cádiz - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad de Cádiz con tests organizados por temas. 27 temas oficiales.',
  keywords: ['test auxiliar administrativo universidad de cádiz', 'oposiciones universidad de cádiz', 'examen auxiliar cadiz', 'test oposiciones C2 cadiz'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Universidad de Cádiz - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad de Cádiz con tests organizados por temas. 27 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-universidad-cadiz" />
}
