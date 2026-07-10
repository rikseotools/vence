// app/enfermero-sas-andalucia/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Enfermero/a del SAS (Andalucía) - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Enfermero/a del Servicio Andaluz de Salud (SAS) con tests organizados por temas. 79 temas oficiales, cuidados de enfermería y clínica.',
  keywords: ['test enfermero sas', 'oposiciones enfermeria andalucia', 'examen enfermero servicio andaluz de salud', 'test oposiciones A2 enfermeria andalucia'],
  openGraph: {
    title: 'Tests Enfermero/a del SAS (Andalucía) - Practica por Temas',
    description: 'Prepara tu oposición de Enfermero/a del Servicio Andaluz de Salud (SAS) con tests organizados por temas. 79 temas oficiales.',
    type: 'website',
  },
}

export default function TestsEnfermeroSasAndaluciaPage() {
  return <TestHubPage oposicion="enfermero-sas-andalucia" />
}
