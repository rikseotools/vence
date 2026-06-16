// app/auxiliar-administrativo-consell-formentera/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo del Consell Insular de Formentera - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo del Consell Insular de Formentera con tests organizados por temas. 20 temas en 2 bloques: organización pública/Derecho administrativo y ofimática.',
  keywords: ['test auxiliar administrativo ayuntamiento formentera', 'oposiciones ayuntamiento formentera', 'examen auxiliar formentera', 'test oposiciones C2 formentera'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo del Consell Insular de Formentera - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo del Consell Insular de Formentera con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarFormenteraPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-consell-formentera" />
}
