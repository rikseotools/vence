// app/auxiliar-administrativo-universidad-uned/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo UNED - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de TCAE del UNED con tests organizados por temas. 21 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria.',
  keywords: ['test tcae sas', 'oposiciones sas andalucia', 'examen tcae sas', 'test oposiciones C2 sermas'],
}

export default function TestsTcaeSermasMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-universidad-uned" />
}
