// app/administrativo-madrid/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo de la Comunidad de Madrid - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Administrativo de la Comunidad de Madrid con tests organizados por temas. 47 temas oficiales.',
  keywords: ['test administrativo comunidad de madrid', 'oposiciones comunidad de madrid', 'examen administrativo comunidad de madrid', 'test oposiciones C1 comunidad de madrid'],
  openGraph: {
    title: 'Tests Administrativo de la Comunidad de Madrid - Practica por Temas',
    description: 'Prepara tu oposición de Administrativo de la Comunidad de Madrid con tests organizados por temas. 47 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAdministrativoMadridPage() {
  return <TestHubPage oposicion="administrativo-madrid" />
}
