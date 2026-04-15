// app/auxiliar-administrativo-diputacion-cadiz/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo de la Diputación Provincial de Cádiz | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo de la Diputación Provincial de Cádiz. Selecciona temas, dificultad y modo de estudio.',
  keywords: ['test auxiliar diputacion cadiz', 'oposiciones diputacion cadiz', 'test aleatorio', 'preparar oposiciones diputacion cadiz'],
}

export default function TestAleatorioDiputacionCádizPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-diputacion-cadiz" />
}
