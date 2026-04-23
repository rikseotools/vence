// app/tcae-canarias/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests TCAE Canarias - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de TCAE del Servicio Canario de Salud con tests organizados por temas. 24 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria.',
  keywords: ['test tcae sermas', 'oposiciones sermas madrid', 'examen tcae sermas', 'test oposiciones C2 sermas'],
}

export default function TestsTcaeSermasMadridPage() {
  return <TestHubPage oposicion="tcae-canarias" />
}
