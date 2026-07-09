// app/administrativa-universidad-de-murcia/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativa - Universidad de Murcia - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Administrativa - Universidad de Murcia con tests organizados por temas. 18 temas oficiales.',
  keywords: ['test técnico auxiliar (auxiliar de servicios) universidad de murcia', 'oposiciones universidad de murcia', 'examen auxiliar servicios murcia', 'test oposiciones C2 murcia'],
  openGraph: {
    title: 'Tests Administrativa - Universidad de Murcia - Practica por Temas',
    description: 'Prepara tu oposición de Administrativa - Universidad de Murcia con tests organizados por temas. 18 temas oficiales.',
    type: 'website',
  },
}

export default function TestsTecnicoAuxiliarUniversidadMurciaPage() {
  return <TestHubPage oposicion="administrativa-universidad-de-murcia" />
}
