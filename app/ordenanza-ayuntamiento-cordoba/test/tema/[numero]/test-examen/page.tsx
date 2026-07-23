// app/ordenanza-ayuntamiento-cordoba/test/tema/[numero]/test-examen/page.tsx
import TestExamenPage from '@/components/test/TestExamenPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TestExamenPage oposicionSlug="ordenanza-ayuntamiento-cordoba" params={params} />
}
