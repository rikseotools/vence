'use client'
// components/oposicionPersonalizada/MisOposiciones.tsx — las tuyas, para editarlas. (T-327)
//
// Va en la MISMA pantalla que el creador, no en otra: editar es crear con el temario ya cargado,
// y dos pantallas casi idénticas divergen en cuanto una recibe un arreglo que la otra no.
//
// Se enseña **cuánta gente la ha elegido**, y no es un adorno: estas oposiciones son públicas, así
// que editar un temario que otros estudian tiene consecuencias. Sin ese número, se edita creyendo
// que solo te afecta a ti.

import { Rueda } from './SelectorArticulos'

export interface ResumenOposicion {
  id: string
  nombre: string
  temas: number
  articulos: number
  vecesElegida: number
  actualizada: string | null
}

/** «3 temas · 47 artículos», sin decir «1 temas». */
function tamano(o: ResumenOposicion): string {
  const t = `${o.temas} ${o.temas === 1 ? 'tema' : 'temas'}`
  const a = `${o.articulos} ${o.articulos === 1 ? 'artículo' : 'artículos'}`
  return `${t} · ${a}`
}

export default function MisOposiciones({
  oposiciones,
  cargando,
  editandoId,
  onEditar,
}: {
  oposiciones: ResumenOposicion[]
  cargando: boolean
  editandoId: string | null
  onEditar: (id: string) => void
}) {
  if (cargando) {
    return (
      <p className="mb-6 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Rueda /> Cargando tus oposiciones…
      </p>
    )
  }
  // Sin ninguna, esta sección no existe: una lista vacía con su título sería ruido justo cuando
  // el usuario tiene que centrarse en crear la primera.
  if (oposiciones.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">
        Tus oposiciones personalizadas ({oposiciones.length})
      </h2>

      <ul className="space-y-2">
        {oposiciones.map((o) => {
          const editando = o.id === editandoId
          return (
            <li
              key={o.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                editando
                  ? 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-50/60 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{o.nombre}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {tamano(o)}
                  {o.vecesElegida > 1 && (
                    <>
                      {' · '}
                      <span className="text-amber-700 dark:text-amber-400">
                        la estudian {o.vecesElegida} personas
                      </span>
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onEditar(o.id)}
                disabled={editando}
                className={`shrink-0 text-sm px-4 py-2 rounded-lg font-medium ${
                  editando
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 cursor-default'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {editando ? 'Editando' : 'Editar'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
