'use client'

// components/TeoriaSearch.tsx
// Buscador del catálogo de teoría. Sincroniza el término con la URL (?q=), de
// modo que la búsqueda la resuelve el SERVIDOR (searchTeoriaCatalog sobre la
// matview): funciona sin JS, es enlazable/compartible y escala con el catálogo.
// Este componente sólo añade la mejora de tecleo (debounce) sobre esa base.

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const DEBOUNCE_MS = 300

export default function TeoriaSearch({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)
  const [isPending, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mantener el input sincronizado si la URL cambia por navegación externa
  // (atrás/adelante del navegador, enlace compartido).
  useEffect(() => {
    setValue(searchParams.get('q') ?? '')
  }, [searchParams])

  const pushQuery = (raw: string) => {
    const q = raw.trim()
    const params = new URLSearchParams(searchParams.toString())
    if (q) params.set('q', q)
    else params.delete('q')
    // Cualquier búsqueda nueva vuelve a la página 1.
    params.delete('page')
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `/teoria?${qs}` : '/teoria', { scroll: false })
    })
  }

  const onChange = (raw: string) => {
    setValue(raw)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => pushQuery(raw), DEBOUNCE_MS)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (timer.current) clearTimeout(timer.current)
    pushQuery(value)
  }

  const clear = () => {
    setValue('')
    if (timer.current) clearTimeout(timer.current)
    pushQuery('')
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <form onSubmit={onSubmit} className="relative mb-6" role="search">
      <label htmlFor="teoria-search" className="sr-only">
        Buscar ley por nombre
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3m1.8-4.7a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
          </svg>
        </span>
        <input
          id="teoria-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          enterKeyHint="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar ley… (ej: Constitución, LPAC, Código Civil)"
          aria-busy={isPending}
          className="block w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-10 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Limpiar búsqueda"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </form>
  )
}
