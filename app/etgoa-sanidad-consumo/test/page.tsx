// app/etgoa-sanidad-consumo/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests ETGOA Sanidad y Consumo - Practica por Temas | Vence',
  description: 'Prepara tu oposición de ETGOA Sanidad y Consumo con tests organizados por temas. 120 temas en 2 bloques: Parte común y Área de Consumo.',
  keywords: ['test etgoa sanidad y consumo', 'oposiciones etgoa', 'examen etgoa', 'test etgoa sanidad y consumo a1'],
  openGraph: {
    title: 'Tests ETGOA Sanidad y Consumo - Practica por Temas',
    description: 'Prepara tu oposición de ETGOA Sanidad y Consumo con tests organizados por temas. 120 temas oficiales BOE.',
    type: 'website',
  },
}

export default function TestsEtgoaSanidadConsumoPage() {
  return <TestHubPage oposicion="etgoa-sanidad-consumo" />
}
