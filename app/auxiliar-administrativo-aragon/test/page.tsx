import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo DGA Aragon - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo de Aragon (DGA) con tests organizados por temas. 20 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo aragon', 'oposiciones dga aragon', 'examen auxiliar aragon', 'test oposiciones C2 aragon'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo DGA Aragon - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAragonPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-aragon" />
}
