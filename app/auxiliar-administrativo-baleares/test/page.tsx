import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Illes Balears - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo CAIB con tests organizados por temas. 36 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo baleares', 'oposiciones caib', 'examen auxiliar baleares', 'test oposiciones C2 baleares'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Illes Balears - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 36 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarBalearesPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-baleares" />
}
