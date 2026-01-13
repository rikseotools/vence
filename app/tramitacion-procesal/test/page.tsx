// app/tramitacion-procesal/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Tramitación Procesal - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Tramitación Procesal y Administrativa con tests organizados por temas. 37 temas en 3 bloques: Organización del Estado, Derecho Procesal e Informática.',
  keywords: ['test tramitación procesal', 'oposiciones justicia', 'examen tramitación procesal', 'test oposiciones C1'],
  openGraph: {
    title: 'Tests Tramitación Procesal - Practica por Temas',
    description: 'Prepara tu oposición de Tramitación Procesal con tests organizados por temas. 37 temas oficiales BOE 2025.',
    type: 'website',
  },
}

export default function TestsTramitacionProcesalPage() {
  return <TestHubPage oposicion="tramitacion-procesal" />
}
