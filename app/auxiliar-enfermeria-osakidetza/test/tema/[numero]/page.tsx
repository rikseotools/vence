// app/auxiliar-enfermeria-osakidetza/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TemaTestPage oposicionSlug="auxiliar-enfermeria-osakidetza" params={params} />
}
