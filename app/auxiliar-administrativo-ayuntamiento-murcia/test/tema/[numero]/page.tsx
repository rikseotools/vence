// app/auxiliar-administrativo-ayuntamiento-murcia/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TemaTestPage oposicionSlug="auxiliar-administrativo-ayuntamiento-murcia" params={params} />
}
