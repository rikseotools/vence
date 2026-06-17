// app/auxiliar-administrativo-diputacion-huelva/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TemaTestPage oposicionSlug="auxiliar-administrativo-diputacion-huelva" params={params} />
}
