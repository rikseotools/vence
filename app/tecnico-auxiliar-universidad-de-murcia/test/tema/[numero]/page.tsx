// app/tecnico-auxiliar-universidad-de-murcia/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TemaTestPage oposicionSlug="tecnico-auxiliar-universidad-de-murcia" params={params} />
}
