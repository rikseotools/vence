// app/auxiliar-administrativo-cyl/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Castilla y León | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo Castilla y León. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test auxiliar cyl', 'oposiciones castilla y leon', 'test aleatorio', 'preparar oposiciones cyl'],
}

export default function TestAleatorioCylPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-cyl" />
}
