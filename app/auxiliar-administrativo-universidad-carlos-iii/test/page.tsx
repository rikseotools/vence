// app/auxiliar-administrativo-universidad-carlos-iii/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo de la Universidad Carlos III de Madrid - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad Carlos III de Madrid con tests organizados por temas. 20 temas en 4 bloques: Materias Comunes y Materias Específicas.',
  keywords: ['test auxiliar administrativo universidad carlos iii', 'oposiciones universidad carlos iii', 'examen auxiliar carlos iii', 'test oposiciones C2 carlos iii'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo de la Universidad Carlos III de Madrid - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo de la Universidad Carlos III de Madrid con tests organizados por temas. 20 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAdministrativoUniversidadCarlosIiiPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-universidad-carlos-iii" />
}
