// app/ujieres-cortes-generales/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuerpo de Ujieres de las Cortes Generales - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuerpo de Ujieres de las Cortes Generales con tests organizados por temas. 17 temas en 1 partes: Derecho y régimen jurídico, Empleados públicos, Gestión financiera, Gestión académica e Informática.',
  keywords: ['ujieres cortes generales', 'ujier cortes generales', 'cuerpo de ujieres', 'ujier congreso de los diputados', 'ujier senado', 'ujieres parlamento', 'oposicion ujier', 'ujieres congreso'],
  openGraph: {
    title: 'Tests Cuerpo de Ujieres de las Cortes Generales - Practica por Temas',
    description: 'Prepara tu oposición de Cuerpo de Ujieres de las Cortes Generales con tests organizados por temas. 17 temas oficiales BOE.',
    type: 'website',
  },
}

export default function TestsUjieresCortesGeneralesPage() {
  return <TestHubPage oposicion="ujieres-cortes-generales" />
}
