// app/auxiliar-administrativo-diputacion-cuenca/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TemaTestPage oposicionSlug="auxiliar-administrativo-diputacion-cuenca" params={params} />
}
