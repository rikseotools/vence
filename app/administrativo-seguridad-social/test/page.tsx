import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo Seguridad Social - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Administrativo de la Seguridad Social con tests organizados por temas. 36 temas en 2 bloques (general y específico).',
  keywords: ['test administrativo seguridad social', 'oposiciones seguridad social', 'examen administrativo seguridad social', 'test oposiciones C1 seguridad social'],
  openGraph: {
    title: 'Tests Administrativo Seguridad Social - Practica por Temas',
    description: 'Prepara tu oposición con tests organizados por temas. 36 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAdministrativoSSPage() {
  return <TestHubPage oposicion="administrativo-seguridad-social" />
}
