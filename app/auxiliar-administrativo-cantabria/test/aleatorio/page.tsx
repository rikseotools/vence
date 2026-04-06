// app/auxiliar-administrativo-cantabria/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Auxiliar Administrativo Gobierno de Cantabria | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Auxiliar Administrativo del Gobierno de Cantabria.',
  keywords: ['test auxiliar cantabria', 'oposiciones gobierno cantabria', 'test aleatorio', 'preparar oposiciones cantabria'],
}

export default function TestAleatorioCantabriaPage() {
  return <RandomTestPage oposicion="auxiliar-administrativo-cantabria" />
}
