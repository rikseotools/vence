// app/auxiliar-administrativo-extremadura/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Junta de Extremadura | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo Junta de Extremadura.',
  keywords: ['test auxiliar extremadura', 'oposiciones junta extremadura', 'test aleatorio', 'preparar oposiciones extremadura'],
}

export default function TestAleatorioExtremaduraPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-extremadura" />
}
