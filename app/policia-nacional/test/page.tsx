// app/policia-nacional/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Policía Nacional - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Policía Nacional con tests organizados por temas. 45 temas oficiales: Derecho, Seguridad, TIC, Inglés y Ortografía.',
  keywords: ['test policía nacional', 'oposiciones policía nacional', 'examen policía nacional', 'test escala básica'],
  openGraph: {
    title: 'Tests Policía Nacional - Practica por Temas',
    description: 'Prepara tu oposición de Policía Nacional con tests organizados por temas. 45 temas oficiales.',
    type: 'website',
  },
}

export default function TestsPoliciaNacionalPage() {
  return <TestHubPage oposicion="policia-nacional" />
}
