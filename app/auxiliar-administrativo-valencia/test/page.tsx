import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Generalitat Valenciana - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo Generalitat Valenciana con tests organizados por temas. 24 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo valencia', 'oposiciones generalitat valenciana', 'examen auxiliar valencia', 'test oposiciones C2 valencia'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Generalitat Valenciana - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 24 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarValenciaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-valencia" />
}
