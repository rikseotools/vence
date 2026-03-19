// app/auxiliar-administrativo-andalucia/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Junta de Andalucía | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo Junta de Andalucía. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test auxiliar andalucia', 'oposiciones junta andalucia', 'test aleatorio', 'preparar oposiciones andalucia'],
}

export default function TestAleatorioAndaluciaPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-andalucia" />
}
