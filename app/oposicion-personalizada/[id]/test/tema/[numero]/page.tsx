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
import AvisoTemarioVacio from '@/components/oposicionPersonalizada/AvisoTemarioVacio'
import { personalizadaUtilizable } from '@/lib/oposicion/objetivoPersonalizado'

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
  const positionType = `personalizada_${limpio}`
  const filas = (await getAdminDb().execute(sql`
    SELECT co.nombre,
           co.created_by_username,
           (SELECT count(*)::int FROM topics t
             WHERE t.position_type = ${positionType} AND t.is_active = true) AS temas
      FROM custom_oposiciones co
     WHERE replace(co.id::text, '-', '') = ${limpio} AND co.is_active = true LIMIT 1
  `)) as unknown as Array<{ nombre: string; created_by_username: string | null; temas: number }>
  if (!filas[0]) notFound()
  const nombre = nombrePublico(filas[0].nombre, filas[0].created_by_username)

  // [T-508] Si la oposición NO TIENE NI UN TEMA, `TemaTestPage` pinta «tema no encontrado» — que
  // es verdad y no ayuda: suena a que ese tema concreto se ha perdido, cuando lo que pasa es que
  // el temario está sin armar. Mismo componente y mismo criterio que la pantalla del temario:
  // dos textos distintos para el mismo estado es como nació este fallo.
  //
  // OJO al alcance: solo cuando NO hay NINGÚN tema. Pedir el tema 9 de un temario que tiene 3
  // sigue siendo «tema no encontrado», que ahí sí es la respuesta correcta.
  if (!personalizadaUtilizable(Number(filas[0].temas ?? 0))) {
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
    <TemaTestPage
      nombreOposicionOverride={nombre}
      oposicionSlug={`oposicion-personalizada/${limpio}`}
      basePathOverride={`/oposicion-personalizada/${limpio}`}
      positionTypeOverride={`personalizada_${limpio}`}
      params={params as unknown as Promise<{ numero: string }>}
    />
  )
}
