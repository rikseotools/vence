// app/cuidador-diputacion-cordoba/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuidador/a de la Diputación Provincial de Córdoba - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuidador/a de la Diputación Provincial de Córdoba con tests organizados por temas. 20 temas en 2 bloques: Materias Comunes y Materias Específicas.',
  keywords: ['test cuidador diputacion cordoba', 'oposiciones cuidador cordoba', 'examen cuidador cordoba', 'test oposiciones cuidador C2 cordoba'],
  openGraph: {
    title: 'Tests Cuidador/a de la Diputación Provincial de Córdoba - Practica por Temas',
    description: 'Prepara tu oposición de Cuidador/a de la Diputación Provincial de Córdoba con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsCuidadorDiputacionCórdobaPage() {
  return <TestHubPage oposicion="cuidador-diputacion-cordoba" />
}
