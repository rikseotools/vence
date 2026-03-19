// app/auxiliar-administrativo-clm/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Junta de Castilla-La Mancha | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo Junta de Castilla-La Mancha.',
  keywords: ['test auxiliar clm', 'oposiciones jccm', 'test aleatorio', 'preparar oposiciones castilla la mancha'],
}

export default function TestAleatorioClmPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-clm" />
}
