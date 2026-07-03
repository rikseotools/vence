// app/celador-sermas-madrid/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Celador SERMAS Madrid - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Celador del SERMAS con tests organizados por temas. 16 temas sobre funciones del celador en instituciones sanitarias.',
  keywords: ['test celador sermas madrid', 'oposiciones celador madrid', 'examen celador sermas madrid', 'test oposiciones celador'],
}

export default function TestsCeladorSermasMadridPage() {
  return <TestHubPage oposicion="celador-sermas-madrid" />
}

// redeploy trigger cdc68f27
