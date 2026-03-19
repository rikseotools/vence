// app/auxiliar-administrativo-andalucia/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Junta de Andalucía - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo Junta de Andalucía con tests organizados por temas. 22 temas en 2 bloques: Jurídico Administrativo y Gestión.',
  keywords: ['test auxiliar administrativo andalucia', 'oposiciones andalucia', 'examen auxiliar junta andalucia', 'test oposiciones C2 andalucia'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Junta de Andalucía - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo Junta de Andalucía con tests organizados por temas. 22 temas oficiales BOJA.',
    type: 'website',
  },
}

export default function TestsAuxiliarAndaluciaPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-andalucia" />
}
