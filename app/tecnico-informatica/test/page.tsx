import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Técnico Auxiliar de Informática (TAI) del Estado - Practica por Temas | Vence',
  description: 'Prepara el Cuerpo de Técnicos Auxiliares de Informática de la Administración del Estado (TAI, C1) con tests organizados por temas. Bloque I (Organización del Estado y Administración electrónica) disponible.',
  keywords: ['test tai estado', 'tecnico auxiliar informatica estado', 'examen tai age', 'test oposiciones informatica estado', 'tai c1'],
  openGraph: {
    title: 'Tests Técnico Auxiliar de Informática (TAI) del Estado - Practica por Temas',
    description: 'Prepara tu oposición TAI del Estado con tests organizados por temas del temario oficial.',
    type: 'website',
  },
}

export default function TestsTaiEstadoPage() {
  return <TestHubPage oposicion="tecnico-informatica" />
}
