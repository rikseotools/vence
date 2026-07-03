// app/celador-ics/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Zelador ICS Catalunya - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Celador del ICS con tests organizados por temas. 17 temas sobre funciones del celador en instituciones sanitarias.',
  keywords: ['test celador ics', 'oposiciones celador catalunya', 'examen celador ics', 'test oposiciones celador'],
}

export default function TestsCeladorIcsPage() {
  return <TestHubPage oposicion="celador-ics" />
}

// redeploy trigger cdc68f27
