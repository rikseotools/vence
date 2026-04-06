import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Gobierno de La Rioja - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo del Gobierno de La Rioja con tests organizados por temas. 23 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo la rioja', 'oposiciones gobierno la rioja', 'examen auxiliar la rioja', 'test oposiciones C2 la rioja'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Gobierno de La Rioja - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 23 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarLaRiojaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-la-rioja" />
}
