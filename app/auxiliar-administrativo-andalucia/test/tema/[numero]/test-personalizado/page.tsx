// app/auxiliar-administrativo-andalucia/test/tema/[numero]/test-personalizado/page.tsx
import TestPersonalizadoPage from '@/components/test/TestPersonalizadoPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TestPersonalizadoPage oposicionSlug="auxiliar-administrativo-andalucia" params={params} />
}
