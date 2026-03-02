// app/auxiliar-administrativo-baleares/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Illes Balears | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo CAIB.',
  keywords: ['test auxiliar baleares', 'oposiciones caib', 'test aleatorio', 'preparar oposiciones baleares'],
}

export default function TestAleatorioBalearesPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-baleares" />
}
