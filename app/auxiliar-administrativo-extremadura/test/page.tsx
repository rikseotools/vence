import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Junta de Extremadura - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo Junta de Extremadura con tests organizados por temas. 25 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo extremadura', 'oposiciones junta extremadura', 'examen auxiliar extremadura', 'test oposiciones C2 extremadura'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Junta de Extremadura - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 25 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarExtremaduraPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-extremadura" />
}
