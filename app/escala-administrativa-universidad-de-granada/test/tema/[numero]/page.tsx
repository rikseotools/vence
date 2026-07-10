// app/escala-administrativa-universidad-de-granada/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TemaTestPage oposicionSlug="escala-administrativa-universidad-de-granada" params={params} />
}
