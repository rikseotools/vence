// app/auxiliar-administrativo-carm/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo CARM - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo CARM (Murcia) con tests organizados por temas. 16 temas en 2 bloques: Derecho y Gestión Pública.',
  keywords: ['test auxiliar administrativo carm', 'oposiciones murcia', 'examen auxiliar carm', 'test oposiciones C2 murcia'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo CARM - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo CARM con tests organizados por temas. 16 temas oficiales BORM.',
    type: 'website',
  },
}

export default function TestsAuxiliarCarmPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-carm" />
}
