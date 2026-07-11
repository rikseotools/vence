// app/etgoa-sanidad-consumo/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TemaTestPage oposicionSlug="etgoa-sanidad-consumo" params={params} />
}
