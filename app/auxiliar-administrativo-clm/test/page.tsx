import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Junta de Castilla-La Mancha - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo Junta de Castilla-La Mancha con tests organizados por temas. 24 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo clm', 'oposiciones jccm', 'examen auxiliar clm', 'test oposiciones C2 castilla la mancha'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Junta de Castilla-La Mancha - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 24 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarClmPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-clm" />
}
