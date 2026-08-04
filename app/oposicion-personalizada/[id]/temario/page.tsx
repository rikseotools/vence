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
import AvisoTemarioVacio from '@/components/oposicionPersonalizada/AvisoTemarioVacio'
import { nombrePublico } from '@/lib/oposicionPersonalizada/nombrePublico'
import { personalizadaUtilizable } from '@/lib/oposicion/objetivoPersonalizado'
import { emitFireAndForget } from '@/lib/observability/emit'

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

  const positionType = `personalizada_${limpio}`
  const filas = (await getAdminDb().execute(sql`
    SELECT co.nombre,
           co.created_by_username,
           -- El tamaño del temario viaja con la cabecera para poder distinguir «no existe» de
           -- «existe y está vacía» SIN una segunda consulta que pueda contestar otra cosa.
           (SELECT count(*)::int FROM topics t
             WHERE t.position_type = ${positionType} AND t.is_active = true) AS temas
      FROM custom_oposiciones co
     WHERE replace(co.id::text, '-', '') = ${limpio} AND co.is_active = true LIMIT 1
  `)) as unknown as Array<{ nombre: string; created_by_username: string | null; temas: number }>
  if (!filas[0]) notFound()

  const nombre = nombrePublico(filas[0].nombre, filas[0].created_by_username)

  // [T-508] EXISTE PERO ESTÁ VACÍA ≠ NO EXISTE.
  //
  // `DynamicTemarioPage` hace `notFound()` cuando no hay bloques, y para el catálogo está bien:
  // un slug sin temario es un slug que no existe. Pero aquí la oposición SÍ existe, es del
  // usuario, y lo único que le falta es contenido — un 404 le dice que la plataforma está rota
  // cuando lo que tiene que hacer es volver al editor. Se decide aquí, que es donde se sabe que
  // la fila existe, y no dentro del componente compartido: cambiarlo allí le quitaría el 404
  // legítimo a las 100+ oposiciones del catálogo.
  if (!personalizadaUtilizable(Number(filas[0].temas ?? 0))) {
    emitFireAndForget({
      source: 'vercel',
      severity: 'warn',
      eventType: 'objetivo_personalizado_vacio',
      endpoint: '/oposicion-personalizada/[id]/temario',
      metadata: { positionType, temas: Number(filas[0].temas ?? 0), bloqueado: false },
    })
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">{nombre}</h1>
          <AvisoTemarioVacio />
        </div>
      </main>
    )
  }

  return (
    <DynamicTemarioPage
      oposicionSlug={`oposicion-personalizada/${limpio}`}
      positionTypeOverride={positionType}
      oposicionDisplayName={nombre}
    />
  )
}
