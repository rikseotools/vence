// app/tcae-sermas-madrid/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio TCAE SERMAS Madrid | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de TCAE del SERMAS. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test tcae sermas', 'oposiciones sermas madrid', 'test aleatorio', 'preparar oposiciones tcae'],
}

export default function TestAleatorioTcaeSermasPage() {
  return <RandomTestPage oposicion="tcae-sermas-madrid" />
}
