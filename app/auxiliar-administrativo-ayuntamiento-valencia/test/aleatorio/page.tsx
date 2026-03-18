// app/auxiliar-administrativo-ayuntamiento-valencia/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Ayuntamiento de Valencia | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo del Ayuntamiento de Valencia. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test auxiliar ayuntamiento valencia', 'oposiciones ayuntamiento valencia', 'test aleatorio', 'preparar oposiciones ayuntamiento valencia'],
}

export default function TestAleatorioAyuntamientoValenciaPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-ayuntamiento-valencia" />
}
