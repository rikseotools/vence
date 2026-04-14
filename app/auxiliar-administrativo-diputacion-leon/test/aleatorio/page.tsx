// app/auxiliar-administrativo-diputacion-leon/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Diputación Provincial de León | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo de la Diputación Provincial de León. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test auxiliar diputacion leon', 'oposiciones diputacion leon', 'test aleatorio', 'preparar oposiciones diputacion leon'],
}

export default function TestAleatorioDiputacionLeónPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-diputacion-leon" />
}
