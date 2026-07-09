// app/escala-administrativa-universidad-de-granada/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Escala Administrativa - Universidad de Granada - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Escala Administrativa - Universidad de Granada con tests organizados por temas. 28 temas oficiales.',
  keywords: ['test escala administrativa universidad de granada', 'oposiciones universidad de granada', 'examen administrativa servicios granada', 'test oposiciones C1 granada'],
  openGraph: {
    title: 'Tests Escala Administrativa - Universidad de Granada - Practica por Temas',
    description: 'Prepara tu oposición de Escala Administrativa - Universidad de Granada con tests organizados por temas. 28 temas oficiales.',
    type: 'website',
  },
}

export default function TestsEscalaAdministrativaUniversidadGranadaPage() {
  return <TestHubPage oposicion="escala-administrativa-universidad-de-granada" />
}
