// app/auxiliar-administrativo-universidad-complutense/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Universidad Complutense de Madrid - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad Complutense de Madrid con tests organizados por temas. 12 temas en 2 bloques: Materias Comunes y Materias Específicas.',
  keywords: ['test auxiliar administrativo universidad complutense', 'oposiciones universidad complutense', 'examen auxiliar complutense', 'test oposiciones C2 complutense'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Universidad Complutense de Madrid - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad Complutense de Madrid con tests organizados por temas. 12 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarDiputacionMadridPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-universidad-complutense" />
}
