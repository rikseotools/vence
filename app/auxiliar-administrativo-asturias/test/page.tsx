import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Principado de Asturias - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo Principado de Asturias con tests organizados por temas. 25 temas en 3 bloques.',
  keywords: ['test auxiliar administrativo asturias', 'oposiciones principado asturias', 'examen auxiliar asturias', 'test oposiciones C2 asturias'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Principado de Asturias - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 25 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAsturiasPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-asturias" />
}
