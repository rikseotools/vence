import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo Gobierno de Navarra - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Administrativo del Gobierno de Navarra con tests organizados por temas. 27 temas en 3 partes.',
  keywords: ['test administrativo navarra', 'oposiciones gobierno navarra', 'examen administrativo navarra', 'test oposiciones C1 navarra'],
  openGraph: {
    title: 'Tests Administrativo Gobierno de Navarra - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 27 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAdministrativoNavarraPage() {
  return <TestHubPage oposicion="administrativo-navarra" />
}
