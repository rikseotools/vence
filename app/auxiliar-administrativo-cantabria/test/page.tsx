import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Gobierno de Cantabria - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo del Gobierno de Cantabria con tests organizados por temas. 25 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo cantabria', 'oposiciones gobierno cantabria', 'examen auxiliar cantabria', 'test oposiciones C2 cantabria'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Gobierno de Cantabria - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 25 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarCantabriaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-cantabria" />
}
