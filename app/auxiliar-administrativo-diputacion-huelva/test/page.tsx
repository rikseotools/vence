// app/auxiliar-administrativo-diputacion-huelva/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Diputación de Huelva - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación de Huelva con tests organizados por temas. 20 temas en 2 bloques: materia común y materia específica.',
  keywords: ['test auxiliar administrativo diputacion huelva', 'oposiciones diputacion huelva', 'examen auxiliar huelva', 'test oposiciones C2 huelva'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Diputación de Huelva - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Diputación de Huelva con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionHuelvaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-diputacion-huelva" />
}
