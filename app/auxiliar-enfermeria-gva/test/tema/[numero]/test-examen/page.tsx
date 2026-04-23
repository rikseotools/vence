// app/auxiliar-enfermeria-gva/test/tema/[numero]/test-examen/page.tsx
import TestExamenPage from '@/components/test/TestExamenPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TestExamenPage oposicionSlug="auxiliar-enfermeria-gva" params={params} />
}
