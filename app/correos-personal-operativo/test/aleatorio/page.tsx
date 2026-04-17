// app/correos-personal-operativo/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Personal Operativo de Correos | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Personal Operativo de Correos. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test auxiliar correos', 'oposiciones correos', 'test aleatorio', 'preparar oposiciones correos'],
}

export default function TestAleatorioCorreosC2Page() {
  return <RandomTestPage oposicion="correos-personal-operativo" />
}
