// app/subalterno-parlamento-andalucia/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TemaTestPage oposicionSlug="subalterno-parlamento-andalucia" params={params} />
}
