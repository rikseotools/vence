'use client'
// components/oposicionPersonalizada/SelectorArticulos.tsx — elegir artículos de una ley. (T-327)
//
// ── LA DECISIÓN QUE SOSTIENE TODO ESTO ──────────────────────────────────────────────────────
//
// La casilla NO lleva estado propio: marca si el artículo **está en el tema**. Llevar dos listas
// —«lo marcado aquí» y «lo que hay en el tema»— es la forma clásica de que se separen: basta con
// quitar un artículo desde el panel de la derecha para que su casilla siga marcada, y a partir de
// ahí la pantalla miente sobre lo que has construido. Con una sola fuente eso no puede pasar.
//
// ── AGRUPACIÓN POR TÍTULO ───────────────────────────────────────────────────────────────────
//
// Los grupos vienen ya calculados del servidor (`agruparPorTitulo`, núcleo puro con 13 tests).
// Aquí solo se pintan, incluido el grupo «Disposiciones y otros»: no caen en ningún rango
// numérico y si no se pintaran, desaparecerían sin que nadie avisara.

import { useCallback, useState } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import { estaEnTema, cuantosEnTema, type Tema } from './temario'

/**
 * Rueda de carga. Misma forma que el resto de la app (`animate-spin` + borde), para no estrenar
 * un indicador propio que se vea distinto al de al lado.
 */
export function Rueda({ clase = 'h-4 w-4' }: { clase?: string }) {
  return (
    <span
      className={`inline-block ${clase} animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]`}
      role="status"
      aria-label="Cargando"
    />
  )
}

export interface GrupoArticulos {
  seccionId: string | null
  titulo: string | null
  articulos: Array<{ article_number: string; question_count: number }>
}

interface Props {
  ley: { lawId: string; shortName: string; slug: string }
  grupos: GrupoArticulos[]
  tema: Tema | undefined
  /** `marcar=true` añade, `false` quita. En lote, para los ticks de título y de «todos». */
  onToggle: (numeros: string[], marcar: boolean) => void
}

export default function SelectorArticulos({ ley, grupos, tema, onToggle }: Props) {
  const [abierto, setAbierto] = useState<Record<string, boolean>>({})
  const [leyendo, setLeyendo] = useState<string | null>(null)
  const [texto, setTexto] = useState<{ numero: string; titulo: string | null; contenido: string } | null>(null)
  const [cargandoTexto, setCargandoTexto] = useState(false)

  const todos = grupos.flatMap((g) => g.articulos.map((a) => a.article_number))
  const marcados = cuantosEnTema(tema, ley.lawId, todos)

  const verArticulo = useCallback(
    async (numero: string) => {
      setLeyendo(numero)
      setCargandoTexto(true)
      setTexto(null)
      try {
        const headers = await getAuthHeaders()
        const res = await fetch(
          `/api/v2/laws/${ley.lawId}/articles/${encodeURIComponent(numero)}`,
          { headers },
        )
        const body = await res.json().catch(() => null)
        if (!res.ok || !body?.success) {
          setTexto({ numero, titulo: null, contenido: 'No se ha podido cargar el texto.' })
          return
        }
        setTexto({ numero, titulo: body.title, contenido: body.content || '(sin texto)' })
      } catch {
        setTexto({ numero, titulo: null, contenido: 'No se ha podido cargar el texto.' })
      } finally {
        setCargandoTexto(false)
      }
    },
    [ley.lawId],
  )

  if (grupos.length === 0) {
    return <p className="mt-3 text-xs text-gray-500">Esta ley no tiene artículos disponibles.</p>
  }

  return (
    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      {/* Marcar / desmarcar toda la ley */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {marcados} de {todos.length} en «{tema?.titulo ?? 'el tema'}»
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onToggle(todos, true)}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Marcar todos
          </button>
          <button
            type="button"
            onClick={() => onToggle(todos, false)}
            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Desmarcar todos
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {/* ── Izquierda: títulos y artículos ──────────────────────────────────── */}
        <div className="max-h-80 overflow-y-auto pr-1">
          {grupos.map((g, i) => {
            const clave = g.seccionId ?? `otros-${i}`
            const nums = g.articulos.map((a) => a.article_number)
            const enTema = cuantosEnTema(tema, ley.lawId, nums)
            const todosMarcados = enTema === nums.length && nums.length > 0
            // Sin título (ley sin estructura) se pinta la lista a secas: una cabecera vacía
            // sería una fila que no dice nada y que encima se puede plegar.
            const conCabecera = g.titulo !== null
            const desplegado = !conCabecera || abierto[clave]

            return (
              <div key={clave} className="mb-2">
                {conCabecera && (
                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={todosMarcados}
                      // «Algunos marcados» se pinta indeterminado: decir «no» cuando hay 12 de 20
                      // dentro sería mentira, y decir «sí» también.
                      ref={(el) => {
                        if (el) el.indeterminate = enTema > 0 && !todosMarcados
                      }}
                      onChange={() => onToggle(nums, !todosMarcados)}
                      className="w-4 h-4 accent-blue-600 shrink-0"
                      aria-label={`Añadir todo el ${g.titulo}`}
                    />
                    <button
                      type="button"
                      onClick={() => setAbierto((p) => ({ ...p, [clave]: !p[clave] }))}
                      className="flex-1 text-left text-xs font-semibold text-gray-800 dark:text-gray-100 hover:underline"
                    >
                      {desplegado ? '▾' : '▸'} {g.titulo}{' '}
                      <span className="font-normal text-gray-400">
                        ({enTema}/{nums.length})
                      </span>
                    </button>
                  </div>
                )}

                {desplegado && (
                  <div className={conCabecera ? 'pl-6' : ''}>
                    {g.articulos.map((a) => {
                      const marcado = estaEnTema(tema, ley.lawId, a.article_number)
                      return (
                        <div
                          key={a.article_number}
                          className={`flex items-center gap-2 py-0.5 rounded px-1 ${
                            leyendo === a.article_number ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => onToggle([a.article_number], !marcado)}
                            className="w-4 h-4 accent-blue-600 shrink-0"
                            aria-label={`Añadir artículo ${a.article_number}`}
                          />
                          <button
                            type="button"
                            onClick={() => verArticulo(a.article_number)}
                            className="flex-1 text-left text-xs text-gray-700 dark:text-gray-200 hover:underline"
                          >
                            Art. {a.article_number}
                            {/* Un artículo sin preguntas se puede meter igual (el temario es
                                suyo), pero se avisa: si no, elegiría a ciegas algo que hoy
                                servirá 0 preguntas. */}
                            {a.question_count === 0 && (
                              <span className="ml-1 text-gray-400">· sin preguntas</span>
                            )}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Derecha: el texto del artículo ──────────────────────────────────── */}
        <div className="max-h-80 overflow-y-auto rounded-lg bg-gray-50 dark:bg-gray-900/50 p-3 border border-gray-200 dark:border-gray-700">
          {!leyendo && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Pulsa sobre un artículo para leerlo aquí antes de decidir si entra en tu temario.
            </p>
          )}
          {cargandoTexto && (
            <p className="flex items-center gap-2 text-xs text-gray-500">
              <Rueda /> Cargando el artículo {leyendo}…
            </p>
          )}
          {texto && (
            <>
              <div className="flex items-start gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={estaEnTema(tema, ley.lawId, texto.numero)}
                  onChange={() =>
                    onToggle([texto.numero], !estaEnTema(tema, ley.lawId, texto.numero))
                  }
                  className="w-4 h-4 accent-blue-600 mt-0.5 shrink-0"
                  aria-label={`Añadir artículo ${texto.numero} al tema`}
                />
                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                  {ley.shortName} · Art. {texto.numero}
                  {texto.titulo ? ` — ${texto.titulo}` : ''}
                </p>
              </div>
              <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {texto.contenido}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
