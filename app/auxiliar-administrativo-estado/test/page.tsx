// app/auxiliar-administrativo-estado/test/page.tsx - Hub de tests Auxiliar Admin. Estado (C2)
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo del Estado - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo del Estado con tests organizados por temas y exámenes oficiales anteriores.',
  keywords: ['test auxiliar administrativo', 'oposiciones estado', 'examen auxiliar administrativo', 'test oposiciones C2'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo del Estado - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo del Estado con tests por temas y exámenes oficiales.',
    type: 'website',
  },
}

export default function Page() {
  return <TestHubPage oposicion="auxiliar-administrativo-estado" />
}
