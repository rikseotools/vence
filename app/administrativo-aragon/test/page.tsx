// app/administrativo-aragon/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Administrativo de la Comunidad Autónoma de Aragón - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Administrativo de la Comunidad Autónoma de Aragón con tests organizados por temas. 35 temas en 2 partes: Derecho y régimen jurídico, Empleados públicos, Gestión financiera, Gestión académica e Informática.',
  keywords: ['administrativo dga', 'administrativo gobierno de aragon', 'cuerpo ejecutivo escala general administrativa aragon', 'administrativo aragon c1'],
  openGraph: {
    title: 'Tests Administrativo de la Comunidad Autónoma de Aragón - Practica por Temas',
    description: 'Prepara tu oposición de Administrativo de la Comunidad Autónoma de Aragón con tests organizados por temas. 35 temas oficiales BOA.',
    type: 'website',
  },
}

export default function TestsAdministrativoAragonPage() {
  return <TestHubPage oposicion="administrativo-aragon" />
}
