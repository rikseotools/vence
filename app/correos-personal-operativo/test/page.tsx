// app/correos-personal-operativo/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Personal Operativo de Correos - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Personal Operativo de Correos con tests organizados por temas. 25 temas en 3 bloques: Derecho Constitucional, Derecho Administrativo y Administración Local.',
  keywords: ['test auxiliar administrativo correos', 'oposiciones correos', 'examen correos', 'test oposiciones C2 correos'],
  openGraph: {
    title: 'Tests Personal Operativo de Correos - Practica por Temas',
    description: 'Prepara tu oposición de Personal Operativo de Correos con tests organizados por temas. 25 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarCorreosC2Page() {
  return <TestHubPage oposicion="correos-personal-operativo" />
}
