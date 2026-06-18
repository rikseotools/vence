// app/auxiliar-administrativo-ayuntamiento-salamanca/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuerpo Auxiliar Administrativo Salamanca - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuerpo Auxiliar Administrativo Salamanca con tests organizados por temas. 27 temas en 6 bloques: Parte Común y Parte Específica.',
  keywords: ['test auxiliar administrativo salamanca', 'oposiciones salamanca', 'examen auxiliar administrativo salamanca', 'test oposiciones C1 salamanca'],
  openGraph: {
    title: 'Tests Cuerpo Auxiliar Administrativo Salamanca - Practica por Temas',
    description: 'Prepara tu oposición de Cuerpo Auxiliar Administrativo Salamanca con tests organizados por temas. 27 temas oficiales DOCM.',
    type: 'website',
  },
}

export default function TestsAuxAytoSalamancaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-salamanca" />
}
