// app/auxiliar-enfermeria-osakidetza/test/page.tsx
import TestHubPage from '@/components/test/TestHubPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tests TCAE Osakidetza - Practica por Temas | Vence',
  description: 'Prepara tu oposicion de TCAE de Osakidetza con tests organizados por temas. 49 temas en 2 bloques: legislacion sanitaria vasca y cuidados auxiliares de enfermeria.',
  keywords: ['test tcae osakidetza', 'oposiciones osakidetza', 'examen tcae pais vasco', 'test oposiciones auxiliar enfermeria euskadi'],
}

export default function TestsTcaeOsakidetzaPage() {
  return <TestHubPage oposicion="auxiliar-enfermeria-osakidetza" />
}
