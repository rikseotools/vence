// app/auxiliar-administrativo-ayuntamiento-murcia/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Ayuntamiento de Murcia | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo del Ayuntamiento de Murcia. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test auxiliar ayuntamiento murcia', 'oposiciones ayuntamiento murcia', 'test aleatorio', 'preparar oposiciones ayuntamiento murcia'],
}

export default function TestAleatorioAyuntamientoMurciaPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-ayuntamiento-murcia" />
}
