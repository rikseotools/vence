// app/auxiliar-administrativo-universidad-carlos-iii/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TemaTestPage oposicionSlug="auxiliar-administrativo-universidad-carlos-iii" params={params} />
}
