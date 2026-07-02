// app/agrupacion-profesional-servicios-publicos-carm/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuerpo Agrup. Prof. Servicios Públicos CARM - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuerpo Agrup. Prof. Servicios Públicos CARM con tests organizados por temas. 12 temas en 2 bloques: Parte Común y Parte Específica.',
  keywords: ['test administrativo murcia', 'oposiciones murcia', 'examen administrativo murcia', 'test oposiciones C1 murcia'],
  openGraph: {
    title: 'Tests Cuerpo Agrup. Prof. Servicios Públicos CARM - Practica por Temas',
    description: 'Prepara tu oposición de Cuerpo Agrup. Prof. Servicios Públicos CARM con tests organizados por temas. 12 temas oficiales BORM.',
    type: 'website',
  },
}

export default function TestsAdministrativoMurciaPage() {
  return <TestHubPage oposicion="agrupacion-profesional-servicios-publicos-carm" />
}
