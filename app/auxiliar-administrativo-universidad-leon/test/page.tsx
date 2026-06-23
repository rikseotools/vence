// app/auxiliar-administrativo-universidad-leon/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Universidad de León - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad de León con tests organizados por temas. 21 temas oficiales.',
  keywords: ['test auxiliar administrativo universidad de león', 'oposiciones universidad de león', 'examen auxiliar leon', 'test oposiciones C2 leon'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Universidad de León - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad de León con tests organizados por temas. 21 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAdministrativoUniversidadLeonPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-universidad-leon" />
}
