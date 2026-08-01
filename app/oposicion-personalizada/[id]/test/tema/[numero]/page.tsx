// app/oposicion-personalizada/[id]/test/tema/[numero]/page.tsx — test de un tema propio. (T-327)
//
// Reutiliza el MISMO `TemaTestPage` que las oposiciones del catálogo. Lo único que cambia es que
// el `position_type` y la ruta base se pasan EXPLÍCITOS, porque una personalizada no está en el
// config estático — y el fallback de ese componente es `auxiliar_administrativo_estado`, así que
// sin pasarlos le serviría a la persona el temario de OTRA oposición sin avisar de nada.

import { notFound } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import TemaTestPage from '@/components/test/TemaTestPage'
import { nombrePublico } from '@/lib/oposicionPersonalizada/nombrePublico'

export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; numero: string }>
}) {
  const { id } = await params
  const limpio = String(id).replace(/-/g, '')
  // Se valida la FORMA antes de tocar nada: un id inventado tiene que dar 404, no una pantalla
  // de test vacía que parece un fallo nuestro.
  if (!/^[0-9a-f]{32}$/i.test(limpio)) notFound()

  // El nombre se resuelve EN EL SERVIDOR: si se dejara al componente, la chapa caería a
  // «Oposicion (C2)» —nombre y subgrupo inventados— mientras carga, y el usuario vería un
  // parpadeo con una oposición que no es la suya.
  const filas = (await getAdminDb().execute(sql`
    SELECT nombre, created_by_username FROM custom_oposiciones
     WHERE replace(id::text, '-', '') = ${limpio} AND is_active = true LIMIT 1
  `)) as unknown as Array<{ nombre: string; created_by_username: string | null }>
  if (!filas[0]) notFound()
  const nombre = nombrePublico(filas[0].nombre, filas[0].created_by_username)

  return (
    <TemaTestPage
      nombreOposicionOverride={nombre}
      oposicionSlug={`oposicion-personalizada/${limpio}`}
      basePathOverride={`/oposicion-personalizada/${limpio}`}
      positionTypeOverride={`personalizada_${limpio}`}
      params={params as unknown as Promise<{ numero: string }>}
    />
  )
}
