// app/tcae-aragon/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio TCAE Aragón | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de TCAE del Servicio Aragonés de Salud. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test tcae aragon', 'oposiciones sermas madrid', 'test aleatorio', 'preparar oposiciones tcae'],
}

export default function TestAleatorioTcaeSermasPage() {
  return <RandomTestPage oposicion="tcae-aragon" />
}
