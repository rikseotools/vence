// app/administrativo-cantabria/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Gobierno de Cantabria - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Gobierno de Cantabria con tests organizados por temas. 40 temas oficiales.',
  keywords: ['test auxiliar administrativo gobierno de cantabria', 'oposiciones gobierno de cantabria', 'examen auxiliar junta-de-cantabria', 'test oposiciones C2 junta-de-cantabria'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Gobierno de Cantabria - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Gobierno de Cantabria con tests organizados por temas. 40 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionMadridPage() {
  return <TestHubPage oposicion="administrativo-cantabria" />
}
