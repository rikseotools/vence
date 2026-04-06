// app/auxiliar-administrativo-la-rioja/test/tema/[numero]/test-examen/page.tsx
import TestExamenPage from '@/components/test/TestExamenPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TestExamenPage oposicionSlug="auxiliar-administrativo-la-rioja" params={params} />
}
