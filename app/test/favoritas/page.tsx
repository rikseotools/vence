// app/test/favoritas/page.tsx
// Repaso de las preguntas que el usuario ha guardado con el corazón (T-261).
// Petición de Laura Zurdo (feedback 46372450, 28/07/2026).
//
// Gemela de `/test/repaso-fallos-v2`: misma estructura (cargar → TestLayout), pero
// las preguntas las elige el usuario a mano en vez de salir de sus fallos.
'use client'
import Link from 'next/link'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import TestLayout from '@/components/TestLayout'
import QuestionReviewCard from '@/components/QuestionReviewCard'
import { getOposicion } from '@/lib/config/oposiciones'
import FavoriteQuestionButton from '@/components/FavoriteQuestionButton'
import type { TestLayoutQuestion } from '@/lib/api/tests'
import { MAX_FAVORITAS_POR_TEST } from '@/lib/api/question-favorites/schemas'

function FavoritasContent() {
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth() as {
    user: { id: string } | null
    loading: boolean
  }
  const [questions, setQuestions] = useState<TestLayoutQuestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [vacio, setVacio] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Se entra por el RESUMEN (qué tengo guardado, agrupado por ley) y desde ahí se
  // arranca el repaso. Ir directo al test escondería lo que el usuario ha reunido,
  // que es justo el valor de la sección. `?ir=test` la salta (enlaces directos).
  const [enTest, setEnTest] = useState(false)
  const [leyesPlegadas, setLeyesPlegadas] = useState<Record<string, boolean>>({})
  // Control global del plegado. `undefined` = cada tarjeta a su aire (estado inicial);
  // true/false = el usuario ha pulsado "desplegar/plegar todas".
  const [todasAbiertas, setTodasAbiertas] = useState<boolean | undefined>(undefined)
  // Por defecto agrupadas por TEMA del programa (decisión 29/07): es como estudia el
  // opositor. La pestaña de leyes queda para quien piense en normas.
  const [agrupacion, setAgrupacion] = useState<'temas' | 'leyes'>('temas')
  // Oposición seleccionada. Vive FUERA de los grupos: es el marco, no un grupo más.
  // `null` = aún sin elegir (se fija sola al cargar: la única que haya, o la del perfil).
  const [oposicionSel, setOposicionSel] = useState<string | null>(null)

  // Guard: no recargar si ya tenemos preguntas (mismo motivo que en repaso de fallos:
  // un re-render no debe reordenar el test en curso).
  const cargadoRef = useRef(false)

  useEffect(() => {
    async function cargar() {
      if (authLoading || cargadoRef.current) return
      if (!user) {
        setError('Inicia sesión para ver tus preguntas guardadas')
        setLoading(false)
        return
      }

      try {
        const headers = await getAuthHeaders()
        if (!headers['Authorization']) {
          setError('Inicia sesión para ver tus preguntas guardadas')
          setLoading(false)
          return
        }

        const res = await fetch('/api/v2/tests/favorite-questions', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // TODAS sus guardadas por defecto, no 20. El defecto de 20 hacía que quien
            // tuviera más viera siempre las mismas y dedujera que las nuevas no se
            // guardaban (Laura, 29/07: tenía 40 y veía 20). `?n=` sigue mandando si alguien
            // quiere un repaso más corto.
            numQuestions: parseInt(searchParams.get('n') || String(MAX_FAVORITAS_POR_TEST), 10),
            orderBy: searchParams.get('order') === 'random' ? 'random' : 'recent',
          }),
        })
        const json = await res.json()

        if (!res.ok || !json.success) {
          setError(json.error || 'No se pudieron cargar tus preguntas guardadas')
        } else if (!json.questions?.length) {
          setVacio(json.message || 'Todavía no has guardado ninguna pregunta')
        } else {
          setQuestions(json.questions)
          cargadoRef.current = true
        }
      } catch {
        setError('No se pudieron cargar tus preguntas guardadas')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [user, authLoading, searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-rose-500 border-t-transparent mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Preparando tus preguntas guardadas...
          </h2>
        </div>
      </div>
    )
  }

  if (error || vacio) {
    const esVacio = !!vacio && !error
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          <div className="text-5xl mb-4">{esVacio ? '🤍' : '⚠️'}</div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">
            {esVacio ? 'Aún no has guardado preguntas' : 'No se pudo cargar'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {esVacio
              ? 'Mientras haces un test, pulsa el corazón de la esquina superior derecha de una pregunta para guardarla. Aquí podrás repasar solo esas.'
              : error}
          </p>
          <Link
            href="/test"
            className="inline-block bg-rose-500 hover:bg-rose-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Ir a los tests
          </Link>
        </div>
      </div>
    )
  }

  const config = {
    name: 'Preguntas guardadas',
    description: 'Repaso de las preguntas que has marcado con el corazón',
    icon: '❤️',
  }

  // Oposiciones presentes entre las guardadas (con su recuento), para el selector.
  const conteoPorOposicion = questions.reduce<Record<string, number>>((acc, q) => {
    const pt = ((q as unknown as Record<string, unknown>).favorito_position_type as string | null) ?? '__sin__'
    acc[pt] = (acc[pt] ?? 0) + 1
    return acc
  }, {})
  const oposiciones = Object.entries(conteoPorOposicion).sort((a, b) => b[1] - a[1])
  const oposicionActiva = oposicionSel ?? oposiciones[0]?.[0] ?? '__sin__'

  const visibles = questions.filter(
    (q) =>
      (((q as unknown as Record<string, unknown>).favorito_position_type as string | null) ?? '__sin__') ===
      oposicionActiva,
  )

  // El repaso arranca con lo que el usuario está viendo (su oposición elegida), no
  // con todo: si la lista dice "Repasar las 3", el test tiene que ser de esas 3.
  if (enTest || searchParams.get('ir') === 'test') {
    return (
      <TestLayout
        tema={0}
        testNumber="favoritas"
        config={config as never}
        questions={visibles as never}
      />
    )
  }

  // Nomenclatura de temas: SIEMPRE "Tema X del Bloque Y" con X = display_number si lo
  // hay (si no, topic_number) e Y en romanos. Es la regla de la casa para hablarle al
  // usuario en los términos de SU programa, nunca con el número interno.
  const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
  const etiquetaTema = (q: Record<string, unknown>): string => {
    const numero = (q.favorito_topic_display_number as number | null) ?? (q.favorito_topic_number as number | null)
    if (numero == null) return 'Sin tema asignado'
    const bloque = q.favorito_bloque_number as number | null
    const base = bloque ? `Tema ${numero} del Bloque ${ROMANOS[bloque] ?? bloque}` : `Tema ${numero}`
    const titulo = q.favorito_topic_title as string | null
    return titulo ? `${base}: ${titulo}` : base
  }

  // La oposición se muestra porque hay quien prepara varias a la vez y, sin ella, dos
  // "Tema 5" distintos parecerían el mismo.
  // Nombre LARGO (el oficial): "Auxiliar Admin." no dice a cuál de todas se refiere.
  const nombreOposicion = (positionType: string | null): string => {
    if (!positionType) return 'Sin oposición asignada'
    return getOposicion(positionType)?.name || positionType
  }

  const agrupar = (clave: (q: Record<string, unknown>) => string) =>
    Object.entries(
      visibles.reduce<Record<string, TestLayoutQuestion[]>>((acc, q) => {
        ;(acc[clave(q as unknown as Record<string, unknown>)] ||= []).push(q)
        return acc
      }, {}),
    ).sort((a, b) => b[1].length - a[1].length)

  // La oposición ya NO va en el título del grupo: está arriba, en el selector.
  const grupos =
    agrupacion === 'temas'
      ? agrupar((q) => etiquetaTema(q))
      : agrupar((q) => (q.law_name as string) || 'Otras')


  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">
            ❤️ Preguntas guardadas
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-5">
            Tienes <strong>{visibles.length}</strong> pregunta{visibles.length === 1 ? '' : 's'} guardada
            {visibles.length === 1 ? '' : 's'} en {grupos.length}{' '}
            {agrupacion === 'temas'
              ? grupos.length === 1 ? 'tema' : 'temas'
              : grupos.length === 1 ? 'norma' : 'normas'}.
          </p>
          <button
            type="button"
            onClick={() => setEnTest(true)}
            className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
          >
            Repasar las {visibles.length}
          </button>
        </div>

        {/* Oposición: ENCIMA de todo, porque es el marco de lo que se lista. Con una
            sola, se muestra como texto (un desplegable de un elemento es ruido). */}
        <div className="mb-4">
          {oposiciones.length > 1 ? (
            <label className="block">
              <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Oposición
              </span>
              <select
                value={oposicionActiva}
                onChange={(e) => {
                  setOposicionSel(e.target.value)
                  setLeyesPlegadas({})
                  setTodasAbiertas(undefined)
                }}
                className="w-full sm:w-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 font-semibold text-gray-800 dark:text-gray-100"
              >
                {oposiciones.map(([pt, n]) => (
                  <option key={pt} value={pt}>
                    {nombreOposicion(pt === '__sin__' ? null : pt)} ({n})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="font-semibold text-gray-800 dark:text-gray-100">
              {nombreOposicion(oposicionActiva === '__sin__' ? null : oposicionActiva)}
            </p>
          )}
        </div>

        {/* Controles de la lista: agrupación + desplegar. Van JUNTOS y encima del
            listado, que es lo que gobiernan. */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="inline-flex rounded-xl bg-white dark:bg-gray-800 p-1 shadow-sm" role="tablist">
            {(['temas', 'leyes'] as const).map((modo) => (
              <button
                key={modo}
                type="button"
                role="tab"
                aria-selected={agrupacion === modo}
                onClick={() => {
                  setAgrupacion(modo)
                  setLeyesPlegadas({})
                  setTodasAbiertas(undefined)
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  agrupacion === modo
                    ? 'bg-rose-500 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {modo === 'temas' ? 'Temas' : 'Leyes'}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const abrir = !todasAbiertas
              setTodasAbiertas(abrir)
              // Desplegar las preguntas exige abrir también sus grupos: si no, el
              // usuario pulsa y no ve nada cambiar.
              setLeyesPlegadas(Object.fromEntries(grupos.map(([g]) => [g, !abrir])))
            }}
            className="border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 font-semibold px-4 py-2 rounded-xl text-sm hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
          >
            {todasAbiertas ? 'Plegar todas' : 'Desplegar todas'}
          </button>
        </div>

        <div className="space-y-3">
          {grupos.map(([grupo, preguntas]) => {
            const plegada = leyesPlegadas[grupo] ?? true
            return (
              <div key={grupo} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setLeyesPlegadas((p) => ({ ...p, [grupo]: !plegada }))}
                  aria-expanded={!plegada}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{grupo}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-sm bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded-full px-2.5 py-0.5">
                      {preguntas.length}
                    </span>
                    <span className="text-gray-400 text-sm">{plegada ? '▾' : '▴'}</span>
                  </span>
                </button>
                {!plegada && (
                  <div className="px-3 pb-4 space-y-2">
                    {/* Pregunta COMPLETA: opciones con la correcta marcada, explicación y
                        artículo — igual que la revisión posterior a un test. Repasar con
                        el enunciado truncado no servía de nada. */}
                    {preguntas.map((q, i) => (
                      <QuestionReviewCard
                        key={q.id}
                        index={i + 1}
                        question={{
                          id: q.id,
                          question: q.question,
                          options: q.options,
                          correct_option: q.correct_option,
                          explanation: q.explanation,
                          article_number: q.article_number ?? null,
                          article_title: q.article_title ?? null,
                          law_name: q.law_name ?? null,
                          law_actual_slug: q.law_actual_slug ?? null,
                        }}
                        open={todasAbiertas}
                        acciones={
                          <FavoriteQuestionButton questionId={q.id} initialIsFavorite />
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function FavoritasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-rose-500 border-t-transparent" />
        </div>
      }
    >
      <FavoritasContent />
    </Suspense>
  )
}
