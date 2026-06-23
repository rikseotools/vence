// app/tcae-canarias/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests TCAE Canarias - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de TCAE del Servicio Canario de Salud con tests organizados por temas. 24 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria.',
  keywords: ['test tcae canarias', 'oposiciones tcae canarias', 'examen tcae canarias', 'test oposiciones C2 servicio canario salud'],
}

export default function TestsTcaeCanariasPage() {
  return <TestHubPage oposicion="tcae-canarias" />
}
