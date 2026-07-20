// app/oficial-de-gestion-parlamento-de-andalucia/test/tema/[numero]/test-examen/page.tsx
import TestExamenPage from '@/components/test/TestExamenPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TestExamenPage oposicionSlug="oficial-de-gestion-parlamento-de-andalucia" params={params} />
}
