// app/tcae-sescam/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests TCAE SESCAM - Practica por Temas | Vence',
  description: 'Prepara tu oposición de TCAE del Servicio de Salud de Castilla-La Mancha (SESCAM) con tests organizados por temas. 30 temas en 2 bloques: legislación sanitaria y cuidados auxiliares de enfermería.',
  keywords: ['test tcae sescam', 'oposiciones sescam castilla la mancha', 'examen tcae sescam', 'test oposiciones C2 sescam'],
}

export default function TestsTcaeSescamPage() {
  return <TestHubPage oposicion="tcae-sescam" />
}
