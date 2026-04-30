// app/guardia-civil/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Guardia Civil - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Guardia Civil con tests organizados por temas. 25 temas oficiales: Derecho, Seguridad, TIC, Inglés y Ortografía.',
  keywords: ['test guardia civil', 'oposiciones guardia civil', 'examen guardia civil', 'test cabos y guardias'],
  openGraph: {
    title: 'Tests Guardia Civil - Practica por Temas',
    description: 'Prepara tu oposición de Guardia Civil con tests organizados por temas. 25 temas oficiales.',
    type: 'website',
  },
}

export default function TestsGuardiaCivilPage() {
  return <TestHubPage oposicion="guardia-civil" />
}
