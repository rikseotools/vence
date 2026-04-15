// app/auxiliar-administrativo-diputacion-cadiz/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Cádiz - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Cádiz con tests organizados por temas. 24 temas en 2 bloques: Materias Comunes y Materias Específicas.',
  keywords: ['test auxiliar administrativo diputacion cadiz', 'oposiciones diputacion cadiz', 'examen auxiliar cadiz', 'test oposiciones C2 cadiz'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación Provincial de Cádiz - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación Provincial de Cádiz con tests organizados por temas. 24 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionCádizPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-diputacion-cadiz" />
}
