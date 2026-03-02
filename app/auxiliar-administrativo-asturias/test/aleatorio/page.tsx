// app/auxiliar-administrativo-asturias/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Principado de Asturias | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo Principado de Asturias.',
  keywords: ['test auxiliar asturias', 'oposiciones principado asturias', 'test aleatorio', 'preparar oposiciones asturias'],
}

export default function TestAleatorioAsturiasPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-asturias" />
}
