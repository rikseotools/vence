import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Xunta de Galicia - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo Xunta de Galicia con tests organizados por temas. 17 temas en 2 partes.',
  keywords: ['test auxiliar administrativo galicia', 'oposiciones xunta de galicia', 'examen auxiliar galicia', 'test oposiciones C2 galicia'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Xunta de Galicia - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 17 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarGaliciaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-galicia" />
}
