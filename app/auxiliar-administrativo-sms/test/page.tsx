import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo del Servicio Murciano de Salud (SMS) - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo del Servicio Murciano de Salud (SMS) con tests organizados por temas. 24 temas en 2 bloques.',
  keywords: ['test auxiliar administrativo sms', 'oposiciones sms', 'examen auxiliar sms', 'test oposiciones C2 servicio murciano de salud'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo del Servicio Murciano de Salud (SMS) - Practica por Temas',
    description: 'Prepara tu oposicion con tests organizados por temas. 24 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarSmsPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-sms" />
}
