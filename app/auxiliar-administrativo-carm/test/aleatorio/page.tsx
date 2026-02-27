// app/auxiliar-administrativo-carm/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo CARM | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo CARM (Murcia). Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test auxiliar carm', 'oposiciones murcia', 'test aleatorio', 'preparar oposiciones carm'],
}

export default function TestAleatorioCarmPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-carm" />
}
