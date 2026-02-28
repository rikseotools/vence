// app/auxiliar-administrativo-madrid/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Comunidad de Madrid - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo Comunidad de Madrid con tests organizados por temas. 21 temas en 2 bloques: Organización Política y Ofimática.',
  keywords: ['test auxiliar administrativo madrid', 'oposiciones comunidad de madrid', 'examen auxiliar madrid', 'test oposiciones C2 madrid'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Comunidad de Madrid - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo Comunidad de Madrid con tests organizados por temas. 21 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-madrid" />
}
