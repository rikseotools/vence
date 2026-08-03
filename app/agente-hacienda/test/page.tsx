// app/agente-hacienda/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Agente de la Hacienda Pública - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Agente de la Hacienda Pública con tests organizados por temas. 32 temas en 2 partes: Materias Comunes y Materias Específicas (Hacienda Pública y Derecho Tributario).',
  keywords: ['agente de hacienda', 'agente hacienda publica', 'agentes de la hacienda publica', 'oposicion agente de hacienda', 'agente tributario aeat', 'cuerpo general administrativo hacienda'],
  openGraph: {
    title: 'Tests Agente de la Hacienda Pública - Practica por Temas',
    description: 'Prepara tu oposición de Agente de la Hacienda Pública con tests organizados por temas. 32 temas oficiales BOE.',
    type: 'website',
  },
}

export default function TestsAgenteHaciendaPage() {
  return <TestHubPage oposicion="agente-hacienda" />
}
