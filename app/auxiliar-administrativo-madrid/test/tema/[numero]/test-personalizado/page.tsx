// app/auxiliar-administrativo-madrid/test/tema/[numero]/test-personalizado/page.tsx
import TestPersonalizadoPage from '@/components/test/TestPersonalizadoPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TestPersonalizadoPage oposicionSlug="auxiliar-administrativo-madrid" params={params} />
}
