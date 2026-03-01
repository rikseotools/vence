// app/auxiliar-administrativo-canarias/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Gobierno de Canarias | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo Gobierno de Canarias.',
  keywords: ['test auxiliar canarias', 'oposiciones gobierno canarias', 'test aleatorio', 'preparar oposiciones canarias'],
}

export default function TestAleatorioCanariasPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-canarias" />
}
