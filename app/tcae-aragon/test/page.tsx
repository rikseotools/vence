// app/tcae-aragon/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests TCAE Aragón - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de TCAE del Servicio Aragonés de Salud con tests organizados por temas. 30 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria.',
  keywords: ['test tcae aragon', 'oposiciones tcae aragon', 'examen tcae aragon', 'test oposiciones C2 servicio aragones salud'],
}

export default function TestsTcaeAragonPage() {
  return <TestHubPage oposicion="tcae-aragon" />
}
