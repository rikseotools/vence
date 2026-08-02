// app/auxiliar-clinica-diputacion-sevilla/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar de Clínica de la Diputación Provincial de Sevilla - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar de Clínica de la Diputación Provincial de Sevilla con tests organizados por temas. 20 temas en 2 partes: Derecho y régimen jurídico, Empleados públicos, Gestión financiera, Gestión académica e Informática.',
  keywords: ['auxiliar de clinica diputacion sevilla', 'auxiliar clinica diputacion de sevilla', 'tcae diputacion sevilla', 'auxiliar de enfermeria diputacion sevilla', 'auxiliar clinica sevilla', 'oposicion auxiliar de clinica sevilla'],
  openGraph: {
    title: 'Tests Auxiliar de Clínica de la Diputación Provincial de Sevilla - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar de Clínica de la Diputación Provincial de Sevilla con tests organizados por temas. 20 temas oficiales BOP.',
    type: 'website',
  },
}

export default function TestsAuxiliarClinicaDiputacionSevillaPage() {
  return <TestHubPage oposicion="auxiliar-clinica-diputacion-sevilla" />
}
