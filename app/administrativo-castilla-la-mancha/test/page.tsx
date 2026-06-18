// app/administrativo-castilla-la-mancha/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuerpo Administrativo Castilla-La Mancha - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuerpo Administrativo Castilla-La Mancha con tests organizados por temas. 36 temas en 2 partes (común y específica): Parte Común y Parte Específica.',
  keywords: ['test administrativo castilla-la mancha', 'oposiciones clm', 'examen administrativo clm', 'test oposiciones C1 castilla-la mancha'],
  openGraph: {
    title: 'Tests Cuerpo Administrativo Castilla-La Mancha - Practica por Temas',
    description: 'Prepara tu oposición de Cuerpo Administrativo Castilla-La Mancha con tests organizados por temas. 36 temas oficiales DOCM.',
    type: 'website',
  },
}

export default function TestsAdministrativoClmPage() {
  return <TestHubPage oposicion="administrativo-castilla-la-mancha" />
}
