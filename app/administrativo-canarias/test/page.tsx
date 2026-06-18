// app/administrativo-canarias/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuerpo Administrativo Canarias - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuerpo Administrativo Canarias con tests organizados por temas. 30 temas en 6 bloques: Parte Común y Parte Específica.',
  keywords: ['test administrativo canarias', 'oposiciones canarias', 'examen administrativo canarias', 'test oposiciones C1 canarias'],
  openGraph: {
    title: 'Tests Cuerpo Administrativo Canarias - Practica por Temas',
    description: 'Prepara tu oposición de Cuerpo Administrativo Canarias con tests organizados por temas. 30 temas oficiales DOCM.',
    type: 'website',
  },
}

export default function TestsAdministrativoCanariasPage() {
  return <TestHubPage oposicion="administrativo-canarias" />
}
