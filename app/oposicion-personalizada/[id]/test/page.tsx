// app/oposicion-personalizada/[id]/test/page.tsx — los tests de TU oposición. (T-327)
//
// ── POR QUÉ NO ES `TestHubPage` ─────────────────────────────────────────────────────────────
//
// El hub del catálogo (`components/test/TestHubPage.tsx`) está construido sobre el config
// estático: bloques, números de tema visibles, convocatorias hermanas, iconos… todo sale de
// `OPOSICIONES`. Una oposición personalizada **no tiene nada de eso** —no tiene bloques, ni
// convocatoria, ni SEO— así que reutilizarlo obligaría a inventarle un config falso solo para
// que el componente no se rompa. Eso es peor que una pantalla propia: ata dos cosas que van a
// evolucionar por separado y deja al de al lado con ramas «si es personalizada» por todas partes.
//
// Lo que SÍ se reutiliza es lo que de verdad cuesta: los tests por tema, con el mismo
// `TemaTestPage` de siempre (ver la ruta hermana `tema/[numero]`).

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { nombrePublico } from '@/lib/oposicionPersonalizada/nombrePublico'
import AvisoTemarioVacio from '@/components/oposicionPersonalizada/AvisoTemarioVacio'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'

// Es contenido de un usuario, cambia cuando él lo edita y no tiene valor de catálogo.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tus tests | Vence',
  robots: { index: false, follow: false },
}

interface TemaFila {
  topic_number: number
  title: string
  leyes: number
  articulos: number
  preguntas: number
}

async function cargar(idSinGuiones: string) {
  const db = getAdminDb()
  const cab = (await db.execute(sql`
    SELECT id, nombre, created_by_username
      FROM custom_oposiciones
     WHERE replace(id::text, '-', '') = ${idSinGuiones} AND is_active = true
     LIMIT 1
  `)) as unknown as Array<{ id: string; nombre: string; created_by_username: string | null }>
  if (!cab[0]) return null

  const positionType = `personalizada_${idSinGuiones}`
  const temas = (await db.execute(sql`
    SELECT t.topic_number,
           t.title,
           count(DISTINCT s.law_id)::int AS leyes,
           -- La ley entera cuenta como 1: enseñar «0 artículos» en un tema que entra una ley
           -- completa le diría al usuario que está vacío cuando no lo está.
           coalesce(sum(CASE WHEN s.article_numbers IS NULL THEN 1
                             ELSE cardinality(s.article_numbers) END), 0)::int AS articulos,
           -- Preguntas SERVIBLES hoy. Es el número que decide si el tema sirve para estudiar,
           -- y por eso se enseña aunque sea cero: un tema a cero no es un error, pero el
           -- usuario tiene que saberlo antes de entrar y encontrarse la pantalla vacía.
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
      LEFT JOIN topic_scope s ON s.topic_id = t.id
     WHERE t.position_type = ${positionType} AND t.is_active = true
     GROUP BY t.id, t.topic_number, t.title
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

  const totalPreguntas = datos.temas.reduce((n, t) => n + Number(t.preguntas || 0), 0)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* [T-521] Las migas son EL sitio donde se cambia de oposición. Sin ellas, quien
          tenía una personalizada como objetivo no podía cambiar: no había botón. */}
      <InteractiveBreadcrumbs personalizada={{ id: limpio, nombre: datos.nombre }} />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{datos.nombre}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            {datos.temas.length} tema(s) · {totalPreguntas} pregunta(s) disponibles
          </p>
          <Link
            href="/oposicion-personalizada"
            className="mt-2 inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Editar este temario
          </Link>
        </header>

        {datos.temas.length === 0 ? (
          // [T-508] El texto vive en el componente compartido: esta pantalla y la de `/temario`
          // dicen lo mismo, y con dos copias volverían a separarse.
          <AvisoTemarioVacio ctaEditor={false} />
        ) : (
          <>
            {totalPreguntas > 0 && (
              // [T-327] Sin este enlace la pantalla de aleatorio era inalcanzable: existía la
              // ruta pero ningún sitio llevaba a ella (causa raíz de por qué "nadie la echaba en
              // falta" pese a estar rota — no había enlace que pisar). Va ARRIBA de la lista de
              // temas porque mezclar varios temas es lo que un temario propio no puede hacer con
              // los tests por tema de abajo.
              <Link
                href={`/oposicion-personalizada/${limpio}/test/aleatorio`}
                className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 hover:bg-blue-100 dark:hover:bg-blue-900/40"
              >
                <span>
                  <span className="block font-semibold text-blue-900 dark:text-blue-100">
                    🎲 Test aleatorio
                  </span>
                  <span className="block text-sm text-blue-700 dark:text-blue-300">
                    Mezcla preguntas de varios temas a la vez
                  </span>
                </span>
                <span className="text-blue-600 dark:text-blue-400">→</span>
              </Link>
            )}
          <ul className="space-y-3">
            {datos.temas.map((t) => {
              const sinPreguntas = Number(t.preguntas) === 0
              return (
                <li
                  key={t.topic_number}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {t.topic_number}. {t.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t.leyes} ley(es) · {t.articulos} artículo(s) ·{' '}
                        {sinPreguntas ? (
                          // Se dice ANTES de entrar. Dejarle pulsar para encontrarse una
                          // pantalla vacía es el peor sitio para enterarse.
                          <span className="text-amber-700 dark:text-amber-400">
                            sin preguntas todavía
                          </span>
                        ) : (
                          `${t.preguntas} pregunta(s)`
                        )}
                      </p>
                    </div>
                    {sinPreguntas ? (
                      <span className="shrink-0 text-sm px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-400">
                        Sin preguntas
                      </span>
                    ) : (
                      <Link
                        href={`/oposicion-personalizada/${limpio}/test/tema/${t.topic_number}`}
                        className="shrink-0 text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
                      >
                        Hacer test
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          </>
        )}
      </div>
    </main>
  )
}
