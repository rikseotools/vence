// app/auxiliar-enfermeria-geriatria-diputacion-cadiz/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar de Enfermería Geriatría de la Diputación de Cádiz - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar de Enfermería Geriatría de la Diputación de Cádiz con tests organizados por temas. 25 temas en 2 partes: Materias Comunes y Materias Específicas.',
  keywords: ['auxiliar de enfermeria geriatria diputacion cadiz', 'tcae diputacion cadiz', 'auxiliar enfermeria diputacion de cadiz', 'auxiliar de enfermeria geriatria cadiz', 'tcae geriatria cadiz', 'oposicion auxiliar enfermeria geriatria cadiz'],
  openGraph: {
    title: 'Tests Auxiliar de Enfermería Geriatría de la Diputación de Cádiz - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar de Enfermería Geriatría de la Diputación de Cádiz con tests organizados por temas. 25 temas oficiales BOP.',
    type: 'website',
  },
}

export default function TestsAuxiliarEnfermeriaGeriatriaDiputacionCadizPage() {
  return <TestHubPage oposicion="auxiliar-enfermeria-geriatria-diputacion-cadiz" />
}
