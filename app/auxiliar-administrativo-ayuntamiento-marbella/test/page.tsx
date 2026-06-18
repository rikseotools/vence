// app/auxiliar-administrativo-ayuntamiento-marbella/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuerpo Auxiliar Administrativo Marbella - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuerpo Auxiliar Administrativo Marbella con tests organizados por temas. 27 temas en 6 bloques: Parte Común y Parte Específica.',
  keywords: ['test auxiliar administrativo marbella', 'oposiciones marbella', 'examen auxiliar administrativo marbella', 'test oposiciones C1 marbella'],
  openGraph: {
    title: 'Tests Cuerpo Auxiliar Administrativo Marbella - Practica por Temas',
    description: 'Prepara tu oposición de Cuerpo Auxiliar Administrativo Marbella con tests organizados por temas. 27 temas oficiales DOCM.',
    type: 'website',
  },
}

export default function TestsAuxAytoMarbellaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-marbella" />
}
