// app/tramitacion-procesal/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Tramitacion Procesal | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Tramitacion Procesal y Administrativa. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test tramitacion procesal', 'oposiciones justicia', 'test aleatorio', 'preparar oposiciones'],
}

export default function TestAleatorioTramitacionPage() {
  return <RandomTestPage oposicion="tramitacion-procesal" />
}
