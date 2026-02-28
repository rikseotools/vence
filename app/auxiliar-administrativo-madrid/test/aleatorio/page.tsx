// app/auxiliar-administrativo-madrid/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Comunidad de Madrid | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo Comunidad de Madrid. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test auxiliar madrid', 'oposiciones comunidad de madrid', 'test aleatorio', 'preparar oposiciones madrid'],
}

export default function TestAleatorioMadridPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-madrid" />
}
