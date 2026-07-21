// app/celador-murcia/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) con tests organizados por temas. 14 temas en 2 partes: Derecho y régimen jurídico, Empleados públicos, Gestión financiera, Gestión académica e Informática.',
  keywords: ['celador sms murcia', 'celador subalterno murcia', 'celador servicio murciano de salud', 'oposicion celador murcia', 'celadores sms'],
  openGraph: {
    title: 'Tests Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) - Practica por Temas',
    description: 'Prepara tu oposición de Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) con tests organizados por temas. 14 temas oficiales BORM.',
    type: 'website',
  },
}

export default function TestsCeladorMurciaPage() {
  return <TestHubPage oposicion="celador-murcia" />
}
