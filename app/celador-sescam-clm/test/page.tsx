// app/celador-sescam-clm/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Celador SESCAM Castilla-La Mancha - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Celador del SESCAM con tests organizados por temas. 15 temas sobre funciones del celador en instituciones sanitarias.',
  keywords: ['test celador sescam clm', 'oposiciones celador castilla-la mancha', 'examen celador sescam clm', 'test oposiciones celador'],
}

export default function TestsCeladorSescamClmPage() {
  return <TestHubPage oposicion="celador-sescam-clm" />
}

// redeploy trigger cdc68f27
