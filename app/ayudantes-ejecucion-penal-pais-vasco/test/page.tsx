// app/ayudantes-ejecucion-penal-pais-vasco/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Ayudantes en Ejecución Penal (Euskadi) - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Ayudantes en Ejecución Penal (Euskadi) con tests organizados por temas. 53 temas en 2 partes: Derecho y régimen jurídico, Empleados públicos, Gestión financiera, Gestión académica e Informática.',
  keywords: ['test ayudantes ejecucion penal euskadi', 'oposiciones ule', 'examen administrativo ule', 'test oposiciones C1 euskadi'],
  openGraph: {
    title: 'Tests Ayudantes en Ejecución Penal (Euskadi) - Practica por Temas',
    description: 'Prepara tu oposición de Ayudantes en Ejecución Penal (Euskadi) con tests organizados por temas. 53 temas oficiales BOPV.',
    type: 'website',
  },
}

export default function TestsAyudantesEjecucionPenalEuskadiPage() {
  return <TestHubPage oposicion="ayudantes-ejecucion-penal-pais-vasco" />
}
