// app/celador-sas/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Celador SAS Andalucía - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Celador del Servicio Andaluz de Salud con tests organizados por temas. 19 temas sobre funciones del celador en instituciones sanitarias.',
  keywords: ['test celador sas', 'oposiciones celador andalucia', 'examen celador sas', 'test oposiciones celador'],
}

export default function TestsCeladorSasAndalucíaPage() {
  return <TestHubPage oposicion="celador-sas" />
}

// redeploy trigger cdc68f27
