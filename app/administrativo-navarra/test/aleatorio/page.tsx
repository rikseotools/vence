// app/administrativo-navarra/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Administrativo Gobierno de Navarra | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Administrativo del Gobierno de Navarra.',
  keywords: ['test administrativo navarra', 'oposiciones gobierno navarra', 'test aleatorio', 'preparar oposiciones navarra'],
}

export default function TestAleatorioNavarraPage() {
  return <RandomTestPage oposicion="administrativo-navarra" />
}
