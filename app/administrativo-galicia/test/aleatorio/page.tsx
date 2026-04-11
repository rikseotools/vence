// app/administrativo-galicia/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Administrativo Xunta de Galicia | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Administrativo Xunta de Galicia.',
  keywords: ['test administrativo galicia', 'oposiciones xunta de galicia', 'test aleatorio', 'preparar oposiciones galicia'],
}

export default function TestAleatorioGaliciaPage() {
  return <RandomTestPage oposicion="administrativo-galicia" />
}
