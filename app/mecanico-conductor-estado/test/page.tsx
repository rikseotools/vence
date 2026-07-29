// app/mecanico-conductor-estado/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado con tests organizados por temas. 15 temas en 2 partes: Derecho y régimen jurídico, Empleados públicos, Gestión financiera, Gestión académica e Informática.',
  keywords: ['parque movil del estado', 'parque móvil del estado', 'conductor parque movil', 'conductor del parque movil del estado', 'mecanico conductor del estado', 'conduccion de vehiculos de transporte por carretera', 'pme conductor', 'conductor age'],
  openGraph: {
    title: 'Tests Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado - Practica por Temas',
    description: 'Prepara tu oposición de Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado con tests organizados por temas. 15 temas oficiales BOE.',
    type: 'website',
  },
}

export default function TestsMecanicoConductorEstadoPage() {
  return <TestHubPage oposicion="mecanico-conductor-estado" />
}
