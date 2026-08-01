// app/oposicion-personalizada/[id]/test/tema/[numero]/test-personalizado/page.tsx — hacer el test de un tema propio. (T-327)
//
// Es el destino del botón de empezar (`buildTestUrl`). Sin esta ruta, el usuario armaba su
// temario, entraba en el tema… y al darle a empezar recibía un 404: podía crear su oposición
// pero no llegar a estudiar con ella, que es justo el punto de todo esto.
//
// Reutiliza el MISMO componente que el catálogo; lo único propio es el `position_type`, porque
// una personalizada no está en el config y el fallback serviría preguntas de OTRA oposición.

import { notFound } from 'next/navigation'
import TestPersonalizadoPage from '@/components/test/TestPersonalizadoPage'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; numero: string }>
}) {
  const { id } = await params
  const limpio = String(id).replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/i.test(limpio)) notFound()

  return (
    <TestPersonalizadoPage
      oposicionSlug={`oposicion-personalizada/${limpio}`}
      basePathOverride={`/oposicion-personalizada/${limpio}`}
      positionTypeOverride={`personalizada_${limpio}`}
      params={params as unknown as Promise<{ numero: string }>}
    />
  )
}
