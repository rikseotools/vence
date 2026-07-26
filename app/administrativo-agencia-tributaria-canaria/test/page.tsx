// app/administrativo-agencia-tributaria-canaria/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Agentes de Tributos - Agencia Tributaria Canaria - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Agentes de Tributos - Agencia Tributaria Canaria con tests organizados por temas. 40 temas en 2 partes: Derecho y régimen jurídico, Empleados públicos, Gestión financiera, Gestión académica e Informática.',
  keywords: ['test agentes tributos canarias', 'oposiciones ule', 'examen administrativo ule', 'test oposiciones C1 agentes tributos canarias'],
  openGraph: {
    title: 'Tests Agentes de Tributos - Agencia Tributaria Canaria - Practica por Temas',
    description: 'Prepara tu oposición de Agentes de Tributos - Agencia Tributaria Canaria con tests organizados por temas. 40 temas oficiales BOC.',
    type: 'website',
  },
}

export default function TestsAdministrativoAgenciaTributariaCanariaPage() {
  return <TestHubPage oposicion="administrativo-agencia-tributaria-canaria" />
}
