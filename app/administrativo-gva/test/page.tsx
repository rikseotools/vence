import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo Generalitat Valenciana C1-01 — Practica por Temas | Vence',
  description: 'Prepara tu oposición de Administrativo Generalitat Valenciana C1-01 con tests organizados por temas. 35 temas en 2 bloques (Parte General + Parte Especial). Convocatoria 58/26.',
  keywords: ['test administrativo valencia', 'administrativo generalitat valenciana', 'examen administrativo gva', 'test oposiciones C1 valencia', 'cuerpo administrativo c1-01', 'convocatoria 58/26'],
  openGraph: {
    title: 'Tests Administrativo Generalitat Valenciana C1-01',
    description: 'Tests por temas y bloques. 35 temas oficiales DOGV. Examen previsto 31/10/2026.',
    type: 'website',
  },
}

export default function TestsAdministrativoGvaPage() {
  return <TestHubPage oposicion="administrativo-gva" />
}
