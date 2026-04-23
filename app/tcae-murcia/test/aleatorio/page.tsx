// app/tcae-murcia/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio TCAE Murcia | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de TCAE del SMS. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test tcae sermas', 'oposiciones sermas madrid', 'test aleatorio', 'preparar oposiciones tcae'],
}

export default function TestAleatorioTcaeSermasPage() {
  return <RandomTestPage oposicion="tcae-murcia" />
}
