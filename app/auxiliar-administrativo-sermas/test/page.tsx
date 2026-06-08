// app/auxiliar-administrativo-sermas/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo SERMAS - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de Auxiliar Administrativo del SERMAS con tests organizados por temas. 31 temas en 5 bloques: organizacion sanitaria, derecho administrativo, personal, gestion e informatica.',
  keywords: ['test auxiliar administrativo sermas', 'oposiciones sermas madrid', 'examen aux admin sermas', 'test oposiciones C2 sermas'],
}

export default function TestsAuxAdminSermasPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-sermas" />
}
