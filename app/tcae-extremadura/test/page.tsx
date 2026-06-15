// app/tcae-extremadura/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests TCAE SES Extremadura - Practica por Temas | Vence',
  description: 'Prepara tu oposición de TCAE del Servicio Extremeño de Salud (SES) con tests organizados por temas. 30 temas en 2 bloques: legislación sanitaria y cuidados auxiliares de enfermería.',
  keywords: ['test tcae ses-extremadura', 'oposiciones ses-extremadura extremadura', 'examen tcae ses-extremadura', 'test oposiciones C2 ses-extremadura'],
}

export default function TestsTcaeExtremaduraPage() {
  return <TestHubPage oposicion="tcae-extremadura" />
}
