// app/auxiliar-enfermeria-osakidetza/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio TCAE Osakidetza | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de TCAE de Osakidetza.',
  keywords: ['test tcae osakidetza', 'oposiciones osakidetza', 'test aleatorio', 'preparar oposiciones tcae pais vasco'],
}

export default function TestAleatorioOsakidetzaPage() {
  return <RandomTestPage oposicion="auxiliar-enfermeria-osakidetza" />
}
