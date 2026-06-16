// app/auxiliar-administrativo-diputacion-alicante/test/tema/[numero]/test-examen/page.tsx
import TestExamenPage from '@/components/test/TestExamenPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TestExamenPage oposicionSlug="auxiliar-administrativo-diputacion-alicante" params={params} />
}
