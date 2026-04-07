// app/auxiliar-administrativo-diputacion-zaragoza/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Diputación Provincial de Zaragoza | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo de la Diputación Provincial de Zaragoza. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test auxiliar diputacion zaragoza', 'oposiciones diputacion zaragoza', 'test aleatorio', 'preparar oposiciones diputacion zaragoza'],
}

export default function TestAleatorioDiputacionZaragozaPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-diputacion-zaragoza" />
}
