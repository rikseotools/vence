// app/administrativo-cantabria/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo del Gobierno de Cantabria - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Administrativo del Gobierno de Cantabria con tests organizados por temas. 40 temas oficiales.',
  keywords: ['test administrativo gobierno de cantabria', 'oposiciones gobierno de cantabria', 'examen administrativo junta-de-cantabria', 'test oposiciones C1 junta-de-cantabria'],
  openGraph: {
    title: 'Tests Administrativo del Gobierno de Cantabria - Practica por Temas',
    description: 'Prepara tu oposición de Administrativo del Gobierno de Cantabria con tests organizados por temas. 40 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAdministrativoCantabriaPage() {
  return <TestHubPage oposicion="administrativo-cantabria" />
}
