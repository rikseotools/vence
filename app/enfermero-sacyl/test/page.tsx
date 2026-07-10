// app/enfermero-sacyl/test/page.tsx - Hub de tests SSR para SEO
import TestHubPage from '@/components/test/TestHubPage'

export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Enfermero/a del SACYL (Castilla y León) - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Enfermero/a del Servicio de Salud de Castilla y León (SACYL) con tests organizados por temas. 54 temas oficiales, cuidados de enfermería y clínica.',
  keywords: ['test enfermero sacyl', 'oposiciones enfermeria castilla y leon', 'examen enfermero servicio salud castilla y leon', 'test oposiciones A2 enfermeria cyl'],
  openGraph: {
    title: 'Tests Enfermero/a del SACYL (Castilla y León) - Practica por Temas',
    description: 'Prepara tu oposición de Enfermero/a del SACYL con tests organizados por temas. 54 temas oficiales.',
    type: 'website',
  },
}

export default function TestsEnfermeroSacylPage() {
  return <TestHubPage oposicion="enfermero-sacyl" />
}
