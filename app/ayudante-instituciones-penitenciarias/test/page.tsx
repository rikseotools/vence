// app/ayudante-instituciones-penitenciarias/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Ayudante de Instituciones Penitenciarias - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Ayudante de Instituciones Penitenciarias con tests organizados por temas. 50 temas en 4 bloques: Derecho Constitucional, Organizacion Judicial y Procedimientos.',
  keywords: ['test ayudante de instituciones penitenciarias', 'oposiciones penitenciarias', 'examen ayudante de instituciones penitenciarias', 'test oposiciones C1'],
  openGraph: {
    title: 'Tests Ayudante de Instituciones Penitenciarias - Practica por Temas',
    description: 'Prepara tu oposicion de Ayudante de Instituciones Penitenciarias con tests organizados por temas. 50 temas oficiales BOE 2025.',
    type: 'website',
  },
}

export default function TestsAuxilioJudicialPage() {
  return <TestHubPage oposicion="ayudante-instituciones-penitenciarias" />
}
