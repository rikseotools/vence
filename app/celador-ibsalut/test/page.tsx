// app/celador-ibsalut/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Celador IB-Salut Balears - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Celador del IB-Salut con tests organizados por temas. 20 temas sobre funciones del celador en instituciones sanitarias.',
  keywords: ['test celador ibsalut', 'oposiciones celador illes-balears', 'examen celador ibsalut', 'test oposiciones celador'],
}

export default function TestsCeladorIbsalutPage() {
  return <TestHubPage oposicion="celador-ibsalut" />
}

// redeploy trigger cdc68f27
