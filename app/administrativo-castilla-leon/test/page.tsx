// app/administrativo-castilla-leon/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Cuerpo Administrativo Castilla y León - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Cuerpo Administrativo Castilla y León con tests organizados por temas. 41 temas en 5 grupos: Organización del Estado y CyL, Derecho administrativo, Empleados públicos, Gestión financiera y Competencias.',
  keywords: ['test auxiliar administrativo castilla y leon', 'oposiciones cyl', 'examen auxiliar cyl', 'test oposiciones C1 castilla y leon'],
  openGraph: {
    title: 'Tests Cuerpo Administrativo Castilla y León - Practica por Temas',
    description: 'Prepara tu oposición de Cuerpo Administrativo Castilla y León con tests organizados por temas. 41 temas oficiales BOCYL.',
    type: 'website',
  },
}

export default function TestsAuxiliarCylPage() {
  return <TestHubPage oposicion="administrativo-castilla-leon" />
}
