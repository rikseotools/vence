import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo Diputación de Valencia C1-01 — Practica por Temas | Vence',
  description: 'Prepara tu oposición de Administrativo Diputación de Valencia C1-01 con tests organizados por temas. 40 temas en 2 bloques (Parte General + Parte Especial). Convocatoria 58/26.',
  keywords: ['test administrativo valencia', 'administrativo Diputación de Valencia', 'examen administrativo diputación valencia', 'test oposiciones C1 valencia', 'administrativo diputación valencia c1', 'convocatoria 03/26'],
  openGraph: {
    title: 'Tests Administrativo Diputación de Valencia C1-01',
    description: 'Tests por temas y bloques. 40 temas oficiales DOGV. Examen previsto 31/10/2026.',
    type: 'website',
  },
}

export default function TestsAdministrativoDiputacionValenciaPage() {
  return <TestHubPage oposicion="administrativo-diputacion-valencia" />
}
