// app/administrativo-carm/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuerpo Administrativo CARM - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuerpo Administrativo CARM con tests organizados por temas. 28 temas en 6 bloques: Parte Común y Parte Específica.',
  keywords: ['test administrativo murcia', 'oposiciones murcia', 'examen administrativo murcia', 'test oposiciones C1 murcia'],
  openGraph: {
    title: 'Tests Cuerpo Administrativo CARM - Practica por Temas',
    description: 'Prepara tu oposición de Cuerpo Administrativo CARM con tests organizados por temas. 28 temas oficiales DOCM.',
    type: 'website',
  },
}

export default function TestsAdministrativoMurciaPage() {
  return <TestHubPage oposicion="administrativo-carm" />
}
