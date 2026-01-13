// app/auxilio-judicial/test/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s | Tests Auxilio Judicial - Vence',
    default: 'Tests Auxilio Judicial - Vence',
  },
  description: 'Tests de oposiciones para Auxilio Judicial. Practica con preguntas por temas del temario oficial BOE 2025.',
}

export default function TestsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
