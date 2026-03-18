// app/auxiliar-administrativo-ayuntamiento-valencia/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Ayuntamiento de Valencia - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Valencia con tests organizados por temas. 21 temas en 2 bloques: Derecho Constitucional y Administración Local.',
  keywords: ['test auxiliar administrativo ayuntamiento valencia', 'oposiciones ayuntamiento valencia', 'examen auxiliar valencia', 'test oposiciones C2 valencia'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Ayuntamiento de Valencia - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo del Ayuntamiento de Valencia con tests organizados por temas. 21 temas oficiales.',
    type: 'website',
  },
}

export default function TestsAuxiliarAyuntamientoValenciaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-valencia" />
}
