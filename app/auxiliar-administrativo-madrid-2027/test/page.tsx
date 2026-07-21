// app/auxiliar-administrativo-madrid-2027/test/page.tsx - Hub de tests SSR para SEO
// Gemela de auxiliar-administrativo-madrid (convocatoria Orden 1628, examen junio 2027, Windows 11).
import TestHubPage from '@/components/test/TestHubPage'

// force-dynamic: TestHubPage hace queries pesadas que causan timeout en build
export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests Auxiliar Administrativo Comunidad de Madrid 2027 (examen junio 2027) | Vence',
  description: 'Prepara la convocatoria 2026 (Orden 1628, examen junio 2027) del Auxiliar Administrativo Comunidad de Madrid con tests por temas. 21 temas en 2 bloques: Organización Política y Ofimática (Windows 11).',
  keywords: ['test auxiliar administrativo madrid 2027', 'oposiciones comunidad de madrid junio 2027', 'examen auxiliar madrid 2027', 'test oposiciones C2 madrid windows 11'],
  openGraph: {
    title: 'Tests Auxiliar Administrativo Comunidad de Madrid 2027 (examen junio 2027)',
    description: 'Prepara la convocatoria 2026 (examen junio 2027) del Auxiliar Administrativo Comunidad de Madrid. 21 temas oficiales, ofimática Windows 11.',
    type: 'website',
  },
}

export default function TestsAuxiliarMadrid2027Page() {
  return <TestHubPage oposicion="auxiliar-administrativo-madrid-2027" />
}
