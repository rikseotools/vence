// app/policia-nacional/test/aleatorio/page.tsx
export const dynamic = 'force-dynamic'
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Policía Nacional | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Policía Nacional. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test policía nacional', 'oposiciones policía nacional', 'test aleatorio', 'preparar oposiciones policía nacional'],
}

export default function TestAleatorioPoliciaNacionalPage() {
  return <RandomTestPage oposicion="policia-nacional" />
}
