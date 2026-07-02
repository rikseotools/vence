// app/agrupacion-profesional-servicios-publicos-carm/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TemaTestPage oposicionSlug="agrupacion-profesional-servicios-publicos-carm" params={params} />
}
