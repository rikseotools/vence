// app/oficial-de-gestion-parlamento-de-andalucia/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Oficial de Gestión del Parlamento de Andalucía - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Oficial de Gestión del Parlamento de Andalucía con tests organizados por temas. 44 temas en 2 partes: Derecho y régimen jurídico, Empleados públicos, Gestión financiera, Gestión académica e Informática.',
  keywords: ['oficial de gestion parlamento de andalucia', 'oficiales de gestion parlamento andalucia', 'oficial gestion parlamento andaluz', 'oposicion oficial de gestion parlamento andalucia'],
  openGraph: {
    title: 'Tests Oficial de Gestión del Parlamento de Andalucía - Practica por Temas',
    description: 'Prepara tu oposición de Oficial de Gestión del Parlamento de Andalucía con tests organizados por temas. 44 temas oficiales BOJA.',
    type: 'website',
  },
}

export default function TestsOficialDeGestionParlamentoDeAndaluciaPage() {
  return <TestHubPage oposicion="oficial-de-gestion-parlamento-de-andalucia" />
}
