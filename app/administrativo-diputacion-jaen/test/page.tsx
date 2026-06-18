// app/administrativo-diputacion-jaen/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuerpo Administrativo Diputación de Jaén - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuerpo Administrativo Diputación de Jaén con tests organizados por temas. 40 temas en 6 bloques: Parte Común y Parte Específica.',
  keywords: ['test administrativo diputación de jaén', 'oposiciones diputación de jaén', 'examen administrativo diputación de jaén', 'test oposiciones C1 diputación de jaén'],
  openGraph: {
    title: 'Tests Cuerpo Administrativo Diputación de Jaén - Practica por Temas',
    description: 'Prepara tu oposición de Cuerpo Administrativo Diputación de Jaén con tests organizados por temas. 40 temas oficiales DOCM.',
    type: 'website',
  },
}

export default function TestsAdministrativoDipJaenPage() {
  return <TestHubPage oposicion="administrativo-diputacion-jaen" />
}
