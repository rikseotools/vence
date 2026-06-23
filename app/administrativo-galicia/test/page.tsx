import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo Xunta de Galicia - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Administrativo Xunta de Galicia con tests organizados por temas. 19 temas en 2 partes.',
  keywords: ['test administrativo galicia', 'oposiciones xunta de galicia', 'examen administrativo galicia', 'test oposiciones C1 galicia'],
  openGraph: {
    title: 'Tests Administrativo Xunta de Galicia - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 19 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAdministrativoGaliciaPage() {
  return <TestHubPage oposicion="administrativo-galicia" />
}
