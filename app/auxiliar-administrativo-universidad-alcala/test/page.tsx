// app/auxiliar-administrativo-universidad-alcala/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Universidad de Alcalá - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad de Alcalá con tests organizados por temas. 18 temas oficiales.',
  keywords: ['test auxiliar administrativo universidad de alcalá', 'oposiciones universidad de alcalá', 'examen auxiliar alcala', 'test oposiciones C2 alcala'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Universidad de Alcalá - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad de Alcalá con tests organizados por temas. 18 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-universidad-alcala" />
}
