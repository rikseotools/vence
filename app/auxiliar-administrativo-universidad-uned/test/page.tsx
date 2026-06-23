// app/auxiliar-administrativo-universidad-uned/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo UNED - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo de la UNED con tests organizados por temas. 21 temas oficiales con preguntas personalizables.',
  keywords: ['test auxiliar administrativo uned', 'oposiciones uned', 'examen auxiliar administrativo uned', 'test oposiciones C2 uned'],
}

export default function TestsAuxiliarAdministrativoUniversidadUnedPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-universidad-uned" />
}
