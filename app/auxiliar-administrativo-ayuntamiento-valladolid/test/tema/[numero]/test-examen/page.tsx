// app/auxiliar-administrativo-ayuntamiento-valladolid/test/tema/[numero]/test-examen/page.tsx
import TestExamenPage from '@/components/test/TestExamenPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TestExamenPage oposicionSlug="auxiliar-administrativo-ayuntamiento-valladolid" params={params} />
}
