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
import SelectorArticulos, { Rueda, type GrupoArticulos } from './SelectorArticulos'
import MisOposiciones, { type ResumenOposicion } from './MisOposiciones'
import {
  anadirArticulo,
  anadirArticulos,
  quitarArticulo,
  quitarArticulos,
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
            <strong>Oposiciones muy minoritarias</strong>, con pocas plazas, que difícilmente vas
            a encontrar en otro sitio y que aquí vas a poder configurarte tú mismo.
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
  const [arts, setArts] = useState<Record<string, GrupoArticulos[]>>({})
  const [cargandoArts, setCargandoArts] = useState<string | null>(null)
  const [errorArts, setErrorArts] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Arranca OCULTA y se decide tras montar: en servidor no hay `localStorage`, y pintarla
  // siempre para esconderla después daría un parpadeo a quien ya la cerró.
  const [mostrarIntro, setMostrarIntro] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null)
  const [guardado, setGuardado] = useState<{ nombre: string; temas: number } | null>(null)
  const [mias, setMias] = useState<ResumenOposicion[]>([])
  const [cargandoMias, setCargandoMias] = useState(true)
  /** Id que se está editando. `null` = estoy creando una nueva. */
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [cargandoEdicion, setCargandoEdicion] = useState(false)
  /**
   * ¿Está desplegado el constructor?
   *
   * Con oposiciones ya creadas arranca PLEGADO: lo primero que quiere quien vuelve es abrir la
   * suya, no encontrarse un formulario vacío que le hace buscar entre campos qué era lo que
   * venía a hacer. Sin ninguna, se despliega solo — no tendría sentido pedirle un clic extra
   * para llegar a lo único que puede hacer.
   */
  const [constructorAbierto, setConstructorAbierto] = useState(false)

  useEffect(() => {
    const almacen = typeof window !== 'undefined' ? window.localStorage : null
    setMostrarIntro(debeMostrarIntro(leerMarca(almacen, userId)))
  }, [userId])

  const recargarMias = useCallback(async () => {
    setCargandoMias(true)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch('/api/v2/oposicion-personalizada', { headers })
      const body = await res.json().catch(() => null)
      const lista = res.ok && body?.success && Array.isArray(body.oposiciones) ? body.oposiciones : []
      setMias(lista)
      // Solo en la PRIMERA carga: si el usuario ya lo ha abierto, recargar la lista tras guardar
      // no puede cerrárselo en la cara.
      setConstructorAbierto((abierto) => abierto || lista.length === 0)
    } catch {
      // Si el listado falla, NO se bloquea la pantalla: crear una oposición nueva sigue
      // funcionando sin saber cuáles tienes ya.
      setMias([])
    } finally {
      setCargandoMias(false)
    }
  }, [])

  useEffect(() => {
    recargarMias()
  }, [recargarMias])

  /** Carga una oposición propia en el constructor para editarla. */
  const editar = useCallback(async (id: string) => {
    setCargandoEdicion(true)
    setErrorGuardar(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/v2/oposicion-personalizada/${id}`, { headers })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.success) {
        setErrorGuardar('No se ha podido abrir esa oposición. Inténtalo otra vez.')
        return
      }
      setTemario({
        nombre: body.nombre,
        temas: (body.temas ?? []).map((t: { titulo: string; articulos: unknown[] }, i: number) => ({
          id: `t${i + 1}`,
          titulo: t.titulo,
          articulos: t.articulos,
        })),
      })
      setTemaActivo('t1')
      setEditandoId(id)
      setGuardado(null)
      setConstructorAbierto(true)
      // Al abrir una para editar, el sitio donde se trabaja es el constructor de abajo.
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setErrorGuardar('No se ha podido abrir esa oposición. Comprueba tu conexión.')
    } finally {
      setCargandoEdicion(false)
    }
  }, [])

  const empezarNueva = useCallback(() => {
    setTemario({ nombre: '', temas: [temaVacio('t1', 1)] })
    setTemaActivo('t1')
    setEditandoId(null)
    setGuardado(null)
    setErrorGuardar(null)
    setConstructorAbierto(true)
  }, [])

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
      // Segundo clic = plegar. Sin esto, abrir una ley no se puede deshacer y la lista crece
      // hasta tapar el resto de resultados.
      if (arts[ley.lawId]) {
        setArts((prev) => {
          const copia = { ...prev }
          delete copia[ley.lawId]
          return copia
        })
        return
      }
      setCargandoArts(ley.lawId)
      setErrorArts(null)
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(`/api/v2/laws/${ley.lawId}/articles`, { headers })
        const body = await res.json().catch(() => null)
        if (!res.ok || !body?.success) {
          // Antes esto se tragaba en silencio y el botón «no hacía nada», que es la peor
          // respuesta posible: el usuario no sabe si ha pulsado mal o si está roto.
          setErrorArts('No se han podido cargar los artículos. Inténtalo otra vez.')
          return
        }
        const grupos: GrupoArticulos[] = Array.isArray(body.grupos) ? body.grupos : []
        setArts((prev) => ({ ...prev, [ley.lawId]: grupos }))
      } catch {
        setErrorArts('No se han podido cargar los artículos. Comprueba tu conexión.')
      } finally {
        setCargandoArts(null)
      }
    },
    [arts],
  )

  const guardar = useCallback(async () => {
    setGuardando(true)
    setErrorGuardar(null)
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(
        editandoId ? `/api/v2/oposicion-personalizada/${editandoId}` : '/api/v2/oposicion-personalizada',
        {
        method: editandoId ? 'PUT' : 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: temario.nombre,
          temas: temario.temas.map((t) => ({
            titulo: t.titulo,
            articulos: t.articulos.map((a) => ({
              lawId: a.lawId,
              articleNumber: a.articleNumber,
            })),
          })),
        }),
      },
      )
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.success) {
        // El primer problema concreto es más útil que «ha ocurrido un error»: casi siempre es
        // «ya tienes una oposición con ese nombre», que el usuario arregla solo.
        setErrorGuardar(
          body?.errores?.[0]?.mensaje ??
            'No se ha podido guardar. Inténtalo otra vez en unos segundos.',
        )
        return
      }
      // Al editar, el PUT no devuelve el nombre (no lo cambia él): se usa el que hay en pantalla.
      setGuardado({ nombre: body.nombre ?? temario.nombre, temas: body.temas })
      recargarMias()
    } catch {
      setErrorGuardar('No se ha podido guardar. Comprueba tu conexión e inténtalo otra vez.')
    } finally {
      setGuardando(false)
    }
  }, [temario, editandoId, recargarMias])

  const anadir = (lawId: string, shortName: string, articleNumber: string) =>
    setTemario((t) => anadirArticulo(t, temaActivo, { lawId, shortName, articleNumber }))

  const tema = temario.temas.find((t) => t.id === temaActivo) ?? temario.temas[0]

  // Guardada: se enseña LO QUE HA QUEDADO, no un «listo» a secas. Quien acaba de dedicar diez
  // minutos a armar un temario necesita ver que está entero antes de fiarse de él.
  if (guardado) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-6">
          <h1 className="text-2xl font-bold text-green-900 dark:text-green-100">
            ✅ {editandoId ? 'Cambios guardados' : 'Tu oposición está guardada'}
          </h1>
          <p className="mt-2 text-green-900/90 dark:text-green-100/90">
            <strong>{nombrePublico(guardado.nombre, autor)}</strong> — {guardado.temas} tema(s).
            Ya funciona como cualquier otra oposición de Vence.
          </p>
        </div>

        <h2 className="mt-8 mb-3 font-semibold text-gray-900 dark:text-white">Lo que has creado</h2>
        <ul className="space-y-3">
          {temario.temas
            .filter((t) => t.articulos.length > 0)
            .map((t, i) => (
              <li
                key={t.id}
                className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
              >
                <p className="font-medium text-gray-900 dark:text-white">
                  {i + 1}. {t.titulo}
                </p>
                <div className="mt-2 space-y-1">
                  {agruparPorLey(t).map((g) => (
                    <p key={g.lawId} className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-semibold">{g.shortName}</span>{' '}
                      {g.articleNumbers === null
                        ? '(toda la ley)'
                        : `— ${g.articleNumbers.length} artículo(s): ${g.articleNumbers.join(', ')}`}
                    </p>
                  ))}
                </div>
              </li>
            ))}
        </ul>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="/oposiciones"
            className="px-5 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
          >
            Ver mis oposiciones
          </a>
          <button
            type="button"
            onClick={() => {
              setGuardado(null)
              setEditandoId(null)
              setTemario({ nombre: '', temas: [temaVacio('t1', 1)] })
              setTemaActivo('t1')
            }}
            className="px-5 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Crear otra
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {editandoId ? 'Edita tu oposición' : 'Crea tu oposición'}
        </h1>
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

      {/* Tus oposiciones, justo después del aviso: si ya tienes alguna, lo primero que quieres
          es abrirla, no volver a crear una desde cero. */}
      <MisOposiciones
        oposiciones={mias}
        cargando={cargandoMias}
        editandoId={editandoId}
        onEditar={editar}
      />

      {cargandoEdicion && (
        <p className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Rueda /> Abriendo tu oposición…
        </p>
      )}

      {/* Con el constructor plegado, este botón es la ÚNICA forma de llegar a él: tiene que
          decir exactamente lo que va a pasar, no un «+» suelto. */}
      {!cargandoMias && !constructorAbierto && (
        <button
          type="button"
          onClick={empezarNueva}
          className="w-full mb-8 py-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-blue-500 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          + Añadir otra oposición personalizada
        </button>
      )}

      {!cargandoMias && constructorAbierto && (
        <>
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
          {errorArts && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{errorArts}</p>}
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
                      {/* Dos caminos, y son decisiones distintas: la ley ENTERA se guarda como
                          «toda la ley» (no como la lista de artículos de hoy, que envejecería),
                          y elegir artículos es para cuando el programa solo pide una parte. */}
                      <div className="shrink-0 flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setTemario((t) =>
                              anadirArticulo(t, temaActivo, {
                                lawId: l.lawId,
                                shortName: l.shortName,
                                articleNumber: null,
                              }),
                            )
                          }
                          className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 whitespace-nowrap"
                          title="Entra la ley completa, y seguirá completa aunque la ley cambie"
                        >
                          Añadir toda la ley
                        </button>
                        <button
                          type="button"
                          onClick={() => cargarArticulos(l)}
                          className="text-sm px-3 py-1.5 rounded-md border border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 whitespace-nowrap"
                        >
                          {cargandoArts === l.lawId ? (
                            <span className="flex items-center gap-1.5">
                              <Rueda clase="h-3 w-3" /> Cargando…
                            </span>
                          ) : arts[l.lawId] ? (
                            'Ocultar artículos'
                          ) : (
                            'Añadir artículos'
                          )}
                        </button>
                      </div>
                    </div>
                    {cargandoArts === l.lawId && (
                      <p className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Rueda /> Cargando los {l.articleCount} artículos de {l.shortName}…
                      </p>
                    )}
                    {arts[l.lawId] && (
                      <SelectorArticulos
                        ley={l}
                        grupos={arts[l.lawId]}
                        tema={tema}
                        onToggle={(numeros, marcar) =>
                          setTemario((t) =>
                            marcar
                              ? anadirArticulos(
                                  t,
                                  temaActivo,
                                  numeros.map((n) => ({
                                    lawId: l.lawId,
                                    shortName: l.shortName,
                                    articleNumber: n,
                                  })),
                                )
                              : quitarArticulos(
                                  t,
                                  temaActivo,
                                  numeros.map((n) => ({ lawId: l.lawId, articleNumber: n })),
                                ),
                          )
                        }
                      />
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
                  className={`rounded-xl border bg-white dark:bg-gray-800 shadow-sm transition ${
                    activo
                      ? 'border-blue-500 ring-2 ring-blue-500/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setTemaActivo(t.id)}
                >
                  {/* CABECERA de la tarjeta: separada del contenido por una línea, para que se
                      lea como «el nombre del tema» y no como una fila más de la lista. */}
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-t-xl border-b ${
                      activo
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
                        : 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    {/* El lápiz DICE que se puede escribir ahí. Sin él, el nombre parece una
                        etiqueta fija: nadie prueba a pulsar un texto que no invita a nada. */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const el = document.getElementById(`titulo-${t.id}`) as HTMLInputElement | null
                        el?.focus()
                        el?.select()
                      }}
                      className="shrink-0 text-gray-400 hover:text-blue-600"
                      title="Cambiar el nombre del tema"
                      aria-label={`Cambiar el nombre de ${t.titulo}`}
                    >
                      ✏️
                    </button>
                    <input
                      id={`titulo-${t.id}`}
                      type="text"
                      value={t.titulo}
                      onChange={(e) => setTemario((x) => renombrarTema(x, t.id, e.target.value))}
                      placeholder="Nombre del tema"
                      className="flex-1 min-w-0 bg-transparent font-semibold text-gray-900 dark:text-white rounded px-1 py-0.5 border border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 outline-none"
                      aria-label="Nombre del tema"
                    />
                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {t.articulos.length}
                    </span>
                    {temario.temas.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setTemario((x) => quitarTema(x, t.id))
                        }}
                        className="shrink-0 text-gray-400 hover:text-red-600"
                        aria-label={`Quitar ${t.titulo}`}
                        title="Quitar este tema"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Solo el tema ACTIVO recibe lo que añades. Decirlo evita el error de
                      buscar a la izquierda y no entender por qué aparece en otro tema. */}
                  {activo && temario.temas.length > 1 && (
                    <p className="px-3 pt-2 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                      ● Lo que añadas entra aquí
                    </p>
                  )}

                  {t.articulos.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-gray-400">
                      Vacío. Busca una ley a la izquierda y marca sus artículos.
                    </p>
                  ) : (
                    <div className="px-3 py-3 space-y-2">
                      {agruparPorLey(t).map((g) => (
                        <div key={g.lawId}>
                          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                            {g.shortName}
                          </p>
                          {g.articleNumbers === null ? (
                            <button
                              type="button"
                              onClick={() =>
                                setTemario((x) =>
                                  quitarArticulo(x, t.id, { lawId: g.lawId, articleNumber: null }),
                                )
                              }
                              className="group mt-1 text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 hover:bg-red-100 dark:hover:bg-red-900/40"
                              title="Quitar la ley entera"
                            >
                              Toda la ley{' '}
                              <span className="text-green-600 group-hover:text-red-600">✕</span>
                            </button>
                          ) : (
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
                          )}
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
            {errorGuardar && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">{errorGuardar}</p>
            )}
            <button
              type="button"
              onClick={guardar}
              disabled={!listo || guardando}
              className={`w-full py-3 rounded-lg font-semibold ${
                listo && !guardando
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
            >
              {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </section>
      </div>
        </>
      )}
    </div>
  )
}
