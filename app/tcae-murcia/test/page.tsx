// app/tcae-murcia/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests TCAE Murcia - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de TCAE del SMS con tests organizados por temas. 44 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria.',
  keywords: ['test tcae sermas', 'oposiciones sermas madrid', 'examen tcae sermas', 'test oposiciones C2 sermas'],
}

export default function TestsTcaeSermasMadridPage() {
  return <TestHubPage oposicion="tcae-murcia" />
}
