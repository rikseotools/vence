// app/tcae-sas/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests TCAE SAS - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de TCAE del Servicio Andaluz de Salud con tests organizados por temas. 29 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria.',
  keywords: ['test tcae sas', 'oposiciones sas andalucia', 'examen tcae sas', 'test oposiciones C2 sas andalucia'],
}

export default function TestsTcaeSasPage() {
  return <TestHubPage oposicion="tcae-sas" />
}
