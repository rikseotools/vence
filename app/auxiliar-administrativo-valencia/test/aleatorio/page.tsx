// app/auxiliar-administrativo-valencia/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Generalitat Valenciana | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo Generalitat Valenciana.',
  keywords: ['test auxiliar valencia', 'oposiciones generalitat valenciana', 'test aleatorio', 'preparar oposiciones valencia'],
}

export default function TestAleatorioValenciaPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-valencia" />
}
