// app/ujieres-cortes-generales/test/tema/[numero]/test-examen/page.tsx
import TestExamenPage from '@/components/test/TestExamenPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TestExamenPage oposicionSlug="ujieres-cortes-generales" params={params} />
}
