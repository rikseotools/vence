// app/auxiliar-administrativo-universidad-huelva/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Universidad de Huelva - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad de Huelva con tests organizados por temas. 17 temas oficiales.',
  keywords: ['test auxiliar administrativo universidad de huelva', 'oposiciones universidad de huelva', 'examen auxiliar huelva', 'test oposiciones C2 huelva'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Universidad de Huelva - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad de Huelva con tests organizados por temas. 17 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-universidad-huelva" />
}
