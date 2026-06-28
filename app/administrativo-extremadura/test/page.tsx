import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo Junta de Extremadura - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Administrativo Junta de Extremadura con tests organizados por temas. 30 temas en 2 bloques.',
  keywords: ['test administrativo extremadura', 'oposiciones junta extremadura', 'examen administrativo extremadura', 'test oposiciones C1 extremadura'],
  openGraph: {
    title: 'Tests Administrativo Junta de Extremadura - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 30 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAdministrativoExtremaduraPage() {
  return <TestHubPage oposicion="administrativo-extremadura" />
}
