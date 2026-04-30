// app/auxiliar-enfermeria-gva/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Aux Enfermería GVA - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar de Enfermería GVA con tests organizados por temas. 24 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria.',
  keywords: ['test auxiliar enfermeria gva', 'oposiciones sermas madrid', 'examen auxiliar enfermeria gva', 'test oposiciones C2 sermas'],
}

export default function TestsTcaeSermasMadridPage() {
  return <TestHubPage oposicion="auxiliar-enfermeria-gva" />
}
