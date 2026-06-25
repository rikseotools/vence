// app/ayudante-instituciones-penitenciarias/test/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | Tests Ayudante de Instituciones Penitenciarias - Vence',
    default: 'Tests Ayudante de Instituciones Penitenciarias - Vence',
  },
  description: 'Tests de oposiciones para Ayudante de Instituciones Penitenciarias. Practica con preguntas por temas del temario oficial BOE 2025.',
}

export default function TestsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
