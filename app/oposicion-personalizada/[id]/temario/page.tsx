// app/oposicion-personalizada/[id]/temario/page.tsx — el temario de TU oposición. (T-327)
//
// Destino del icono 📚 del Header, que hace `getTestsLink().replace('/test','/temario')`. Sin
// esta ruta ese icono llevaba a un 404 para quien tuviera su personalizada como objetivo.
//
// Mismo componente que el catálogo: lee de `oposicion_bloques` + `topics`, así que con el
// `position_type` correcto funciona igual. Lo único propio es el nombre, que no está en el config.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'
import { nombrePublico } from '@/lib/oposicionPersonalizada/nombrePublico'

export const dynamic = 'force-dynamic'

// Es el temario de un usuario: no es contenido de catálogo y no debe indexarse.
export const metadata: Metadata = {
  title: 'Tu temario | Vence',
  robots: { index: false, follow: false },
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limpio = String(id).replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/i.test(limpio)) notFound()

  const filas = (await getAdminDb().execute(sql`
    SELECT nombre, created_by_username FROM custom_oposiciones
     WHERE replace(id::text, '-', '') = ${limpio} AND is_active = true LIMIT 1
  `)) as unknown as Array<{ nombre: string; created_by_username: string | null }>
  if (!filas[0]) notFound()

  return (
    <DynamicTemarioPage
      oposicionSlug={`oposicion-personalizada/${limpio}`}
      positionTypeOverride={`personalizada_${limpio}`}
      oposicionDisplayName={nombrePublico(filas[0].nombre, filas[0].created_by_username)}
    />
  )
}
