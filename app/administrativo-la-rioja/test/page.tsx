// app/administrativo-la-rioja/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuerpo Administrativo La Rioja - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuerpo Administrativo La Rioja con tests organizados por temas. 42 temas en 6 bloques: Parte Común y Parte Específica.',
  keywords: ['test administrativo la rioja', 'oposiciones la rioja', 'examen administrativo la rioja', 'test oposiciones C1 la rioja'],
  openGraph: {
    title: 'Tests Cuerpo Administrativo La Rioja - Practica por Temas',
    description: 'Prepara tu oposición de Cuerpo Administrativo La Rioja con tests organizados por temas. 42 temas oficiales DOCM.',
    type: 'website',
  },
}

export default function TestsAdministrativoLaRiojaPage() {
  return <TestHubPage oposicion="administrativo-la-rioja" />
}
