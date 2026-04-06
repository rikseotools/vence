// app/auxiliar-administrativo-la-rioja/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Gobierno de La Rioja | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo del Gobierno de La Rioja.',
  keywords: ['test auxiliar la rioja', 'oposiciones gobierno la rioja', 'test aleatorio', 'preparar oposiciones la rioja'],
}

export default function TestAleatorioLaRiojaPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-la-rioja" />
}
