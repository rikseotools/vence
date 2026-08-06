// app/oposicion-personalizada/[id]/test/aleatorio/page.tsx — test aleatorio de TODA tu
// oposición personalizada, cruzando varios temas. (T-327)
//
// ── POR QUÉ NO ES `/test/aleatorio` ─────────────────────────────────────────────────────────
//
// `/test/aleatorio` resuelve la oposición con `getOposicionConfig(positionType)`, que sale de
// `OPOSICIONES` — un array literal hardcodeado en el fuente. Una personalizada (`personalizada_
// <id>`) es una fila dinámica en `topics`/`topic_scope`: nunca puede estar en ese array, así que
// esa página se queda cargando para siempre (`oposicionConfig` es `null` eternamente). Causa
// raíz reproducida leyendo el código el 06/08 (ver ficha [T-327]); esta página sigue el patrón
// YA decidido para el hub (`app/oposicion-personalizada/[id]/test/page.tsx`): página propia que
// consulta `topics`/`topic_scope` DIRECTAMENTE, sin pasar por el config estático.
//
// Sin blocks (una personalizada no tiene bloques temáticos), así que el picker es una lista
// plana con casillas — no hace falta reconstruir la UI de blocks/expand de la página del catálogo.
//
// ── POR QUÉ SÍ REUTILIZA `TestPageWrapper` ──────────────────────────────────────────────────
//
// El propio motor de test (`TestPageWrapper` → `fetchAleatorioMultiTema` → `/api/questions/
// filtered`) YA es genérico: recibe `positionType` y `themes` (números de tema) como props/
// parámetros explícitos y consulta la BD directamente — no depende del config estático en
// ningún punto de la cadena (comprobado leyendo los tres ficheros). El único código roto para
// personalizadas era el PICKER (la pantalla de selección de temas), no el motor.

import { notFound } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { nombrePublico } from '@/lib/oposicionPersonalizada/nombrePublico'
import { personalizadaUtilizable } from '@/lib/oposicion/objetivoPersonalizado'
import AvisoTemarioVacio from '@/components/oposicionPersonalizada/AvisoTemarioVacio'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import AleatorioPersonalizadoPicker from '@/components/oposicionPersonalizada/AleatorioPersonalizadoPicker'

export const dynamic = 'force-dynamic'

interface TemaFila {
  topic_number: number
  title: string
  preguntas: number
}

async function cargar(idSinGuiones: string) {
  const db = getAdminDb()
  const cab = (await db.execute(sql`
    SELECT nombre, created_by_username
      FROM custom_oposiciones
     WHERE replace(id::text, '-', '') = ${idSinGuiones} AND is_active = true
     LIMIT 1
  `)) as unknown as Array<{ nombre: string; created_by_username: string | null }>
  if (!cab[0]) return null

  const positionType = `personalizada_${idSinGuiones}`
  // Misma query que el hub (`test/page.tsx`) para el recuento de preguntas servibles — un tema a
  // 0 no se oculta, se muestra deshabilitado, mismo criterio que la lista de temas.
  const temas = (await db.execute(sql`
    SELECT t.topic_number,
           t.title,
           (SELECT count(*)::int
              FROM questions q
              JOIN articles a ON a.id = q.primary_article_id
             WHERE q.is_active = true
               AND EXISTS (
                 SELECT 1 FROM topic_scope s2
                  WHERE s2.topic_id = t.id
                    AND s2.law_id = a.law_id
                    AND (s2.article_numbers IS NULL OR a.article_number = ANY(s2.article_numbers))
               )) AS preguntas
      FROM topics t
     WHERE t.position_type = ${positionType} AND t.is_active = true
     ORDER BY t.topic_number
  `)) as unknown as TemaFila[]

  return {
    nombre: nombrePublico(cab[0].nombre, cab[0].created_by_username),
    temas,
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limpio = String(id).replace(/-/g, '')
  if (!/^[0-9a-f]{32}$/i.test(limpio)) notFound()

  const datos = await cargar(limpio)
  if (!datos) notFound()

  const temasConPreguntas = datos.temas.filter((t) => Number(t.preguntas) > 0)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <InteractiveBreadcrumbs personalizada={{ id: limpio, nombre: datos.nombre }} />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Test aleatorio · {datos.nombre}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Elige de qué temas quieres preguntas — el test las mezcla todas.
          </p>
        </header>

        {!personalizadaUtilizable(datos.temas.length) ? (
          <AvisoTemarioVacio personalizadaId={limpio} />
        ) : temasConPreguntas.length === 0 ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-amber-900 dark:text-amber-100">
            Ninguno de tus temas tiene preguntas todavía. Añade leyes o artículos con preguntas
            desde el editor del temario.
          </div>
        ) : (
          <AleatorioPersonalizadoPicker
            personalizadaId={limpio}
            nombre={datos.nombre}
            temas={temasConPreguntas.map((t) => ({
              topicNumber: t.topic_number,
              title: t.title,
              preguntas: t.preguntas,
            }))}
          />
        )}
      </div>
    </main>
  )
}
