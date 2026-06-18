// app/administrativo-universidad-leon/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Escala Administrativa Universidad de León - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Escala Administrativa Universidad de León con tests organizados por temas. 25 temas en 5 bloques: Derecho y régimen jurídico, Empleados públicos, Gestión financiera, Gestión académica e Informática.',
  keywords: ['test auxiliar administrativo universidad de leon', 'oposiciones ule', 'examen auxiliar ule', 'test oposiciones C1 universidad de leon'],
  openGraph: {
    title: 'Tests Escala Administrativa Universidad de León - Practica por Temas',
    description: 'Prepara tu oposición de Escala Administrativa Universidad de León con tests organizados por temas. 25 temas oficiales BOCYL.',
    type: 'website',
  },
}

export default function TestsAuxiliarCylPage() {
  return <TestHubPage oposicion="administrativo-universidad-leon" />
}
