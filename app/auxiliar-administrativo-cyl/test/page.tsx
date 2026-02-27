// app/auxiliar-administrativo-cyl/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Castilla y León - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Auxiliar Administrativo Castilla y León con tests organizados por temas. 28 temas en 2 grupos: Organización Política y Administrativa, y Competencias.',
  keywords: ['test auxiliar administrativo castilla y leon', 'oposiciones cyl', 'examen auxiliar cyl', 'test oposiciones C2 castilla y leon'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Castilla y León - Practica por Temas',
    description: 'Prepara tu oposición de Auxiliar Administrativo Castilla y León con tests organizados por temas. 28 temas oficiales BOCYL.',
    type: 'website',
  },
}

export default function TestsAuxiliarCylPage() {
  return <TestHubPage oposicion="auxiliar-administrativo-cyl" />
}
