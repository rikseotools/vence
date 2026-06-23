// app/administrativo-andalucia/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo de la Junta de Andalucía - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Administrativo de la Junta de Andalucía con tests organizados por temas. 42 temas oficiales.',
  keywords: ['test administrativo junta de andalucía', 'oposiciones junta de andalucía', 'examen administrativo junta-de-andalucia', 'test oposiciones C1 junta-de-andalucia'],
  openGraph: {
    title: 'Tests Administrativo de la Junta de Andalucía - Practica por Temas',
    description: 'Prepara tu oposición de Administrativo de la Junta de Andalucía con tests organizados por temas. 42 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAdministrativoAndaluciaPage() {
  return <TestHubPage oposicion="administrativo-andalucia" />
}
