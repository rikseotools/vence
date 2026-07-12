// app/auxiliar-archivos-estado/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Archivos) - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Archivos) con tests organizados por temas. 48 temas en 4 partes: Derecho y régimen jurídico, Empleados públicos, Gestión financiera, Gestión académica e Informática.',
  keywords: ['test auxiliar de archivos (estado)', 'oposiciones ule', 'examen administrativo ule', 'test oposiciones C1 auxiliar de archivos (estado)'],
  openGraph: {
    title: 'Tests Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Archivos) - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar de Archivos, Bibliotecas y Museos del Estado (Sección Archivos) con tests organizados por temas. 48 temas oficiales BOE.',
    type: 'website',
  },
}

export default function TestsAuxiliarArchivosEstadoPage() {
  return <TestHubPage oposicion="auxiliar-archivos-estado" />
}
