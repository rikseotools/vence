// app/ayudantes-ejecucion-penal-pais-vasco/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TemaTestPage oposicionSlug="ayudantes-ejecucion-penal-pais-vasco" params={params} />
}
