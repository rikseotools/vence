// app/enfermero-scs-cantabria/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Enfermero/a del SCS (Cantabria) - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Enfermero/a del Servicio Cántabro de Salud (SCS) con tests organizados por temas. 65 temas oficiales, cuidados de enfermería y clínica.',
  keywords: ['test enfermero scs', 'oposiciones enfermeria cantabria', 'examen enfermero servicio cantabro de salud', 'test oposiciones A2 enfermeria cantabria'],
  openGraph: {
    title: 'Tests Enfermero/a del SCS (Cantabria) - Practica por Temas',
    description: 'Prepara tu oposición de Enfermero/a del Servicio Cántabro de Salud (SCS) con tests organizados por temas. 65 temas oficiales.',
    type: 'website',
  },
}

export default function TestsEnfermeroScsCantabriaPage() {
  return <TestHubPage oposicion="enfermero-scs-cantabria" />
}
