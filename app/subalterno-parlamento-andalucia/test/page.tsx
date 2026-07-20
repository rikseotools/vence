// app/subalterno-parlamento-andalucia/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Subalternos del Parlamento de Andalucía - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Subalternos del Parlamento de Andalucía con tests organizados por temas. 15 temas en 2 partes: Derecho y régimen jurídico, Empleados públicos, Gestión financiera, Gestión académica e Informática.',
  keywords: ['subalterno parlamento de andalucia', 'subalternos parlamento andalucia', 'subalterno parlamento andaluz', 'ordenanza parlamento de andalucia', 'oposicion subalterno parlamento andalucia'],
  openGraph: {
    title: 'Tests Subalternos del Parlamento de Andalucía - Practica por Temas',
    description: 'Prepara tu oposición de Subalternos del Parlamento de Andalucía con tests organizados por temas. 15 temas oficiales BOJA.',
    type: 'website',
  },
}

export default function TestsSubalternoParlamentoAndaluciaPage() {
  return <TestHubPage oposicion="subalterno-parlamento-andalucia" />
}
