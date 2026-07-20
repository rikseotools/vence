// app/auxiliar-administrativo-ayuntamiento-huesca/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo del Ayuntamiento de Huesca - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Huesca con tests organizados por temas. 28 temas oficiales.',
  keywords: ['test auxiliar administrativo ayuntamiento de huesca', 'oposiciones ayuntamiento de huesca', 'examen auxiliar huesca', 'test oposiciones C2 huesca'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo del Ayuntamiento de Huesca - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Huesca con tests organizados por temas. 28 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAdministrativoAyuntamientoHuescaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-huesca" />
}
