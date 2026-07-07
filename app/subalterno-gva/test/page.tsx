import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Subalterno/a Generalitat Valenciana - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Subalterno/a de la Generalitat Valenciana (Conv. 80/26) con tests organizados por temas. 15 temas en 2 bloques.',
  keywords: ['test subalterno valencia', 'oposiciones subalterno generalitat valenciana', 'examen subalterno gva', 'test oposiciones AP valencia'],
  openGraph: {
    title: 'Tests Subalterno/a Generalitat Valenciana - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 15 temas oficiales.',
    type: 'website',
  },
}

export default function TestsSubalternoGvaPage() {
  return <TestHubPage oposicion="subalterno-gva" />
}
