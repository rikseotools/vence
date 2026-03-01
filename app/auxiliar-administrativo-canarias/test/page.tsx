import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Gobierno de Canarias - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo Gobierno de Canarias con tests organizados por temas. 40 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo canarias', 'oposiciones gobierno canarias', 'examen auxiliar canarias', 'test oposiciones C2 canarias'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Gobierno de Canarias - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 40 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarCanariasPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-canarias" />
}
