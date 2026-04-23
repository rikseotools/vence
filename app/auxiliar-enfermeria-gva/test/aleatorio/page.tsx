// app/auxiliar-enfermeria-gva/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Aux Enfermería GVA | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar de Enfermería GVA. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test auxiliar enfermeria gva', 'oposiciones sermas madrid', 'test aleatorio', 'preparar oposiciones tcae'],
}

export default function TestAleatorioTcaeSermasPage() {
  return <RandomTestPage oposicion="auxiliar-enfermeria-gva" />
}
