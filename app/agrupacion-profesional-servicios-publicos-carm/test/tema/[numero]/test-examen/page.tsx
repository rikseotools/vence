// app/agrupacion-profesional-servicios-publicos-carm/test/tema/[numero]/test-examen/page.tsx
import TestExamenPage from '@/components/test/TestExamenPage'

export default function Page({ params }: { params: Promise<{ numero: string }> }) {
  return <TestExamenPage oposicionSlug="agrupacion-profesional-servicios-publicos-carm" params={params} />
}
