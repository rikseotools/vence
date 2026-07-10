import TestHubPage from '@/components/test/TestHubPage'
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'Tests Enfermero/a del ICS (Cataluña) - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Enfermero/a del Institut Català de la Salut (ICS) con tests organizados por temas. 19 temas oficiales, 1.371 plazas.',
  keywords: ['test enfermero ics', 'oposicions infermeria ics', 'examen enfermero institut catala salut', 'test oposiciones A2 enfermeria cataluña'],
  openGraph: { title: 'Tests Enfermero/a del ICS (Cataluña) - Practica por Temas', description: 'Tests por temas de Enfermero/a del ICS. 19 temas oficiales.', type: 'website' },
}
export default function TestsEnfermeroIcsPage() { return <TestHubPage oposicion="enfermero-ics" /> }
