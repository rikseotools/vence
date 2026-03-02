// app/auxiliar-administrativo-aragon/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo DGA Aragon | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo de Aragon (DGA).',
  keywords: ['test auxiliar aragon', 'oposiciones dga aragon', 'test aleatorio', 'preparar oposiciones aragon'],
}

export default function TestAleatorioAragonPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-aragon" />
}
