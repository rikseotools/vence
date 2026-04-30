// app/guardia-civil/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Guardia Civil | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Guardia Civil. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test guardia civil', 'oposiciones guardia civil', 'test aleatorio', 'preparar oposiciones guardia civil'],
}

export default function TestAleatorioGuardiaCivilPage() {
  return <RandomTestPage oposicion="guardia-civil" />
}
