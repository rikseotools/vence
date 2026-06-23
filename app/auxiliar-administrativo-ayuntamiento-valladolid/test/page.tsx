// app/auxiliar-administrativo-ayuntamiento-valladolid/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuerpo Auxiliar Administrativo Valladolid - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuerpo Auxiliar Administrativo Valladolid con tests organizados por temas. 27 temas en 6 bloques: Parte Común y Parte Específica.',
  keywords: ['test auxiliar administrativo valladolid', 'oposiciones valladolid', 'examen auxiliar administrativo valladolid', 'test oposiciones C2 valladolid'],
  openGraph: {
    title: 'Tests Cuerpo Auxiliar Administrativo Valladolid - Practica por Temas',
    description: 'Prepara tu oposición de Cuerpo Auxiliar Administrativo Valladolid con tests organizados por temas. 27 temas oficiales del Ayuntamiento de Valladolid.',
    type: 'website',
  },
}

export default function TestsAuxAytoValladolidPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-ayuntamiento-valladolid" />
}
