'use client'
// components/oposicionPersonalizada/CreadorTemario.tsx — armar tu propio temario. (T-327)
//
// La lógica de QUÉ entra en el temario NO está aquí: vive en `./temario.ts` (puro y testeado).
// Esta pantalla solo pinta y llama. Así el día que cambie el diseño no se lleva por delante las
// reglas que deciden lo que acaba en la base de datos.
//
// El buscador es el de `/teoria` reutilizado vía `/api/v2/laws/search`: busca por NOMBRE de ley
// y por CONTENIDO del articulado. Lo segundo es lo que hace usable esto — los programas
// oficiales muchas veces no nombran la ley, dicen la materia («silencio administrativo»), y sin
// poder preguntar «¿en qué ley está esto?» el usuario no sabe ni qué ley elegir.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import { debeMostrarIntro, leerMarca, marcarVisto } from './introVisto'
import {
  anadirArticulo,
  quitarArticulo,
  renombrarTema,
  quitarTema,
  agruparPorLey,
  problemasParaGuardar,
  puedeGuardar,
  totalArticulos,
  nombrePublico,
  temaVacio,
  type Temario,
} from './temario'

const DEBOUNCE_MS = 300
const HL_START = '⟦'
const HL_END = '⟧'

interface LeyHit {
  lawId: string
  shortName: string
  name: string
  slug: string
  articleCount: number
}
interface ContenidoHit {
  lawId: string
  shortName: string
  slug: string
  articleNumber: string
  snippet: string
}

/** Pinta el fragmento resaltado SIN dangerouslySetInnerHTML (los sentinelas vienen del FTS). */
function Fragmento({ texto }: { texto: string }) {
  const trozos = useMemo(() => {
    const out: Array<{ t: string; hl: boolean }> = []
    let resto = texto ?? ''
    while (resto.length) {
      const i = resto.indexOf(HL_START)
      if (i === -1) {
        out.push({ t: resto, hl: false })
        break
      }
      if (i > 0) out.push({ t: resto.slice(0, i), hl: false })
      const j = resto.indexOf(HL_END, i)
      if (j === -1) {
        out.push({ t: resto.slice(i + 1), hl: false })
        break
      }
      out.push({ t: resto.slice(i + 1, j), hl: true })
      resto = resto.slice(j + 1)
    }
    return out
  }, [texto])
  return (
    <>
      {trozos.map((p, i) =>
        p.hl ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-600/50 rounded px-0.5">
            {p.t}
          </mark>
        ) : (
          <span key={i}>{p.t}</span>
        ),
      )}
    </>
  )
}

/**
 * Explicación de para qué sirve esta pantalla. Se cierra con la ✕ y no vuelve a salir.
 *
 * No es decoración: quien llega aquí ve un buscador de leyes y una lista de temas vacía, y sin
 * este texto no tiene forma de saber que lo que está mirando resuelve SU problema. El problema,
 * además, es de gente concreta y medida: **303 usuarios** tienen hoy una oposición personalizada
 * como objetivo y **127 no han hecho ni un solo test** (30/07) — se apuntaron a una etiqueta que
 * no tenía temario detrás. Por eso el texto nombra los dos casos en voz alta, para que quien
 * esté en ellos se reconozca.
 */
function Intro({ onCerrar }: { onCerrar: () => void }) {
  return (
    <section
      className="relative mb-8 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-5 pr-12"
      aria-labelledby="intro-oposicion-personalizada"
    >
      <button
        type="button"
        onClick={onCerrar}
        aria-label="He entendido, cerrar la explicación"
        title="Cerrar (no volverá a salir)"
        className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        ✕
      </button>

      <h2
        id="intro-oposicion-personalizada"
        className="text-lg font-bold text-blue-900 dark:text-blue-100"
      >
        Aquí puedes crear tu propia oposición
      </h2>

      <div className="mt-2 space-y-2 text-sm text-blue-900/90 dark:text-blue-100/90">
        <p>
          Si no encuentras tu oposición en Vence, no tienes que esperar a que la montemos: puedes
          armar tú mismo su temario, tema a tema, con las leyes y los artículos que entran en tu
          programa. Al guardarla funcionará como cualquier otra oposición (tests, estadísticas y
          repaso de fallos incluidos).
        </p>
        <p>Está pensada sobre todo para dos situaciones:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Oposiciones de A1 y A2</strong>, que son mucho más específicas y donde cada
            opositor necesita su propia combinación de leyes (un temario cerrado no le vale a
            todo el mundo).
          </li>
          <li>
            <strong>Oposiciones muy minoritarias</strong>, con pocas plazas, que difícilmente
            vamos a tener montadas y que aun así hay que estudiar.
          </li>
        </ul>
        <p className="text-blue-800/80 dark:text-blue-200/80">
          Si tu programa habla de una materia sin decir de qué ley es (que es lo normal), búscala
          por su contenido y te diremos en qué ley y en qué artículo está.
        </p>
        <p className="font-medium">
          Cuando la termines, tu oposición será pública y otros opositores podrán elegirla, pero
          solo tú podrás modificarla.
        </p>
      </div>

      <button
        type="button"
        onClick={onCerrar}
        className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
      >
        Entendido, vamos a configurarla
      </button>
    </section>
  )
}

export default function CreadorTemario({
  autor,
  userId,
}: {
  autor?: string | null
  userId?: string | null
}) {
  const [temario, setTemario] = useState<Temario>({ nombre: '', temas: [temaVacio('t1', 1)] })
  const [temaActivo, setTemaActivo] = useState('t1')
  const [q, setQ] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [leyes, setLeyes] = useState<LeyHit[]>([])
  const [contenido, setContenido] = useState<ContenidoHit[]>([])
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  // Artículos de una ley concreta, cuando el usuario despliega una ley del resultado.
  const [arts, setArts] = useState<Record<string, string[]>>({})
  const [cargandoArts, setCargandoArts] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Arranca OCULTA y se decide tras montar: en servidor no hay `localStorage`, y pintarla
  // siempre para esconderla después daría un parpadeo a quien ya la cerró.
  const [mostrarIntro, setMostrarIntro] = useState(false)

  useEffect(() => {
    const almacen = typeof window !== 'undefined' ? window.localStorage : null
    setMostrarIntro(debeMostrarIntro(leerMarca(almacen, userId)))
  }, [userId])

  const cerrarIntro = useCallback(() => {
    setMostrarIntro(false)
    marcarVisto(typeof window !== 'undefined' ? window.localStorage : null, userId)
  }, [userId])

  const problemas = problemasParaGuardar(temario)
  const listo = puedeGuardar(temario)

  // ── Búsqueda con debounce ────────────────────────────────────────────────────────────────
  const buscar = useCallback(async (termino: string) => {
    if (!termino.trim()) {
      setLeyes([])
      setContenido([])
      setErrorBusqueda(null)
      return
    }
    setBuscando(true)
    setErrorBusqueda(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/v2/laws/search?q=${encodeURIComponent(termino)}`, { headers })
      if (!res.ok) {
        setErrorBusqueda(
          res.status === 401
            ? 'Inicia sesión para buscar leyes.'
            : 'No se ha podido buscar. Inténtalo otra vez.',
        )
        setLeyes([])
        setContenido([])
        return
      }
      const body = await res.json()
      setLeyes(body.leyes ?? [])
      setContenido(body.contenido ?? [])
    } catch {
      setErrorBusqueda('No se ha podido buscar. Inténtalo otra vez.')
    } finally {
      setBuscando(false)
    }
  }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => buscar(q), DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q, buscar])

  // ── Artículos de una ley (para elegir uno a uno) ─────────────────────────────────────────
  const cargarArticulos = useCallback(
    async (ley: LeyHit) => {
      if (arts[ley.lawId]) return
      setCargandoArts(ley.lawId)
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(
          `/api/v2/test-config/articles?lawShortName=${encodeURIComponent(ley.shortName)}`,
          { headers },
        )
        const body = await res.json().catch(() => null)
        const lista: string[] = Array.isArray(body?.articles)
          ? body.articles.map((a: { article_number?: string; articleNumber?: string }) =>
              String(a.article_number ?? a.articleNumber ?? ''),
            ).filter(Boolean)
          : []
        setArts((prev) => ({ ...prev, [ley.lawId]: lista }))
      } catch {
        setArts((prev) => ({ ...prev, [ley.lawId]: [] }))
      } finally {
        setCargandoArts(null)
      }
    },
    [arts],
  )

  const anadir = (lawId: string, shortName: string, articleNumber: string) =>
    setTemario((t) => anadirArticulo(t, temaActivo, { lawId, shortName, articleNumber }))

  const tema = temario.temas.find((t) => t.id === temaActivo) ?? temario.temas[0]

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Crea tu oposición</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          Arma tu propio temario eligiendo las leyes y los artículos que entran en cada tema. Si no
          sabes en qué ley está una materia, búscala por su contenido.
        </p>
        {!mostrarIntro && (
          // Quien la cerró tiene que poder volver a leerla: cerrar una explicación no debería ser
          // irreversible, y sin esta salida el único modo de recuperarla sería borrar datos del
          // navegador. No se guarda el «reabierto»: es solo para esta visita.
          <button
            type="button"
            onClick={() => setMostrarIntro(true)}
            className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ¿Para qué sirve esto?
          </button>
        )}
      </header>

      {mostrarIntro && <Intro onCerrar={cerrarIntro} />}

      {/* Nombre */}
      <section className="mb-8">
        <label htmlFor="nombre-oposicion" className="block font-semibold text-gray-900 dark:text-white mb-2">
          ¿Cómo se llama tu oposición?
        </label>
        <input
          id="nombre-oposicion"
          type="text"
          value={temario.nombre}
          onChange={(e) => setTemario((t) => ({ ...t, nombre: e.target.value }))}
          placeholder="Ej.: Agente de Hacienda"
          className="w-full max-w-xl px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        {temario.nombre.trim().length >= 3 && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Se publicará como{' '}
            <strong className="text-gray-800 dark:text-gray-200">
              {nombrePublico(temario.nombre, autor)}
            </strong>{' '}
            — otros opositores podrán elegirla, pero solo tú puedes modificarla.
          </p>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* ─── Izquierda: buscador ─────────────────────────────────────────────── */}
        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white mb-2">1. Busca la materia</h2>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ley 39/2015, o «silencio administrativo»…"
            className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Puedes buscar por el nombre de la ley o por lo que dice: si tu programa habla de una
            materia sin decir la ley, escríbela tal cual.
          </p>

          {errorBusqueda && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{errorBusqueda}</p>
          )}
          {buscando && <p className="mt-3 text-sm text-gray-500">Buscando…</p>}

          {leyes.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Leyes ({leyes.length})
              </h3>
              <ul className="space-y-2">
                {leyes.map((l) => (
                  <li
                    key={l.lawId}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white">{l.shortName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{l.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{l.articleCount} artículos</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => cargarArticulos(l)}
                        className="shrink-0 text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                      >
                        {cargandoArts === l.lawId ? '…' : 'Ver artículos'}
                      </button>
                    </div>
                    {arts[l.lawId] && (
                      <div className="mt-3 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                        {arts[l.lawId].length === 0 && (
                          <p className="text-xs text-gray-500">Sin artículos disponibles.</p>
                        )}
                        {arts[l.lawId].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => anadir(l.lawId, l.shortName, n)}
                            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-200"
                          >
                            Art. {n}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {contenido.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Aparece en el texto de estos artículos ({contenido.length})
              </h3>
              <ul className="space-y-2">
                {contenido.map((c) => (
                  <li
                    key={`${c.lawId}-${c.articleNumber}`}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {c.shortName} · Art. {c.articleNumber}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                          <Fragmento texto={c.snippet} />
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => anadir(c.lawId, c.shortName, c.articleNumber)}
                        className="shrink-0 text-sm px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700"
                      >
                        Añadir
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* ─── Derecha: temario ────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">2. Tu temario</h2>
            <button
              type="button"
              onClick={() =>
                setTemario((t) => {
                  const id = `t${Date.now()}`
                  setTemaActivo(id)
                  return { ...t, temas: [...t.temas, temaVacio(id, t.temas.length + 1)] }
                })
              }
              className="text-sm px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              + Añadir tema
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {totalArticulos(temario)} artículo(s) en {temario.temas.length} tema(s). Lo que añadas
            va al tema seleccionado.
          </p>

          <ul className="space-y-3">
            {temario.temas.map((t) => {
              const activo = t.id === temaActivo
              return (
                <li
                  key={t.id}
                  className={`rounded-lg border p-3 ${
                    activo
                      ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                  onClick={() => setTemaActivo(t.id)}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={t.titulo}
                      onChange={(e) => setTemario((x) => renombrarTema(x, t.id, e.target.value))}
                      className="flex-1 bg-transparent font-medium text-gray-900 dark:text-white border-b border-transparent focus:border-gray-400 outline-none"
                      aria-label="Título del tema"
                    />
                    {temario.temas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setTemario((x) => quitarTema(x, t.id))}
                        className="text-xs text-gray-400 hover:text-red-600"
                        aria-label={`Quitar ${t.titulo}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {t.articulos.length === 0 ? (
                    <p className="mt-2 text-xs text-gray-400">
                      Vacío. Busca a la izquierda y pulsa «Añadir».
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {agruparPorLey(t).map((g) => (
                        <div key={g.lawId}>
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                            {g.shortName}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {g.articleNumbers.map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() =>
                                  setTemario((x) =>
                                    quitarArticulo(x, t.id, { lawId: g.lawId, articleNumber: n }),
                                  )
                                }
                                className="group text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-red-100 dark:hover:bg-red-900/40"
                                title="Quitar"
                              >
                                Art. {n} <span className="text-gray-400 group-hover:text-red-600">✕</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {/* Guardado */}
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            {problemas.length > 0 && (
              <ul className="mb-3 space-y-1">
                {problemas.map((p, i) => (
                  <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                    • {p.mensaje}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              disabled={!listo}
              className={`w-full py-3 rounded-lg font-semibold ${
                listo
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              Guardar mi oposición
            </button>
            <p className="mt-2 text-xs text-gray-400 text-center">
              El guardado se conecta en el siguiente paso.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
