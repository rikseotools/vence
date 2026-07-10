// app/enfermero-sms/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Enfermero/a del SMS (Murcia) - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Enfermero/a del Servicio Murciano de Salud (SMS) con tests organizados por temas. 71 temas oficiales, cuidados de enfermería y clínica.',
  keywords: ['test enfermero sms', 'oposiciones enfermeria murcia', 'examen enfermero servicio murciano de salud', 'test oposiciones A2 enfermeria murcia'],
  openGraph: {
    title: 'Tests Enfermero/a del SMS (Murcia) - Practica por Temas',
    description: 'Prepara tu oposición de Enfermero/a del Servicio Murciano de Salud (SMS) con tests organizados por temas. 71 temas oficiales.',
    type: 'website',
  },
}

export default function TestsEnfermeroSmsPage() {
  return <TestHubPage oposicion="enfermero-sms" />
}
