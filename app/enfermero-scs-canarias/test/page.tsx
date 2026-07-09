// app/enfermero-scs-canarias/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Enfermero SCS Canarias - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Enfermero/a del Servicio Canario de la Salud con tests organizados por temas. 50 temas sobre cuidados de enfermería, metodología y clínica.',
  keywords: ['test enfermero scs', 'oposiciones enfermero canarias', 'examen enfermero scs', 'test oposiciones enfermero'],
}

export default function TestsEnfermeroScsCanariasPage() {
  return <TestHubPage oposicion="enfermero-scs-canarias" />
}
