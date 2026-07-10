'use client'

// components/TeoriaSearch.tsx
// Buscador del catálogo de teoría. Sincroniza el término con la URL (?q=): la
// búsqueda la resuelve el SERVIDOR (searchTeoriaCatalog sobre la matview), es
// enlazable/compartible y escala con el catálogo.
//
// GATE DE CUOTA (2026-07): antes de navegar a una nueva búsqueda, consulta
// /api/teoria/search (server-side: Redis + premium + device/IP). Free+anónimos
// tienen 5 búsquedas/día; premium ilimitado. Si el gate devuelve 429, se muestra
// el CTA (registro para anónimos, premium para logueados) y NO se navega. Ver
// lib/api/featureLimits.ts. Fail-open: si el gate falla (red), se navega igual.

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getAuthHeaders } from '@/lib/api/authHeaders'

const DEBOUNCE_MS = 300

interface Blocked {
  loggedIn: boolean
  limit: number
}

export default function TeoriaSearch({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)
  const [isPending, startTransition] = useTransition()
  const [blocked, setBlocked] = useState<Blocked | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mantener el input sincronizado si la URL cambia por navegación externa
  // (atrás/adelante del navegador, enlace compartido).
  useEffect(() => {
    setValue(searchParams.get('q') ?? '')
  }, [searchParams])

  const navigate = (q: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (q) params.set('q', q)
    else params.delete('q')
    params.delete('page') // cualquier búsqueda nueva vuelve a la página 1
    const qs = params.toString()
    startTransition(() => {
      router.replace(qs ? `/teoria?${qs}` : '/teoria', { scroll: false })
    })
  }

  const pushQuery = async (raw: string) => {
    const q = raw.trim()
    // Limpiar / volver al catálogo no consume cuota ni se gatea.
    if (!q) {
      setBlocked(null)
      navigate('')
      return
    }
    // Gate de cuota ANTES de navegar. Fail-open ante error de red.
    try {
      const headers = await getAuthHeaders()
      const res = await fetch(`/api/teoria/search?q=${encodeURIComponent(q)}`, { headers })
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}))
        setBlocked({ loggedIn: !!body.loggedIn, limit: Number(body.limit) || 5 })
        return
      }
    } catch {
      // Fail-open: no bloquear al usuario por un fallo nuestro.
    }
    setBlocked(null)
    navigate(q)
  }

  const onChange = (raw: string) => {
    setValue(raw)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void pushQuery(raw) }, DEBOUNCE_MS)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (timer.current) clearTimeout(timer.current)
    void pushQuery(value)
  }

  const clear = () => {
    setValue('')
    if (timer.current) clearTimeout(timer.current)
    void pushQuery('')
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
          placeholder="Busca una ley por nombre… o una palabra del texto"
          aria-busy={isPending}
          aria-describedby="teoria-search-help"
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
      <p id="teoria-search-help" className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Escribe el nombre de una ley (ej. <em>Constitución</em>, <em>LPAC</em>) o cualquier
        término que aparezca en su articulado (ej. <em>excedencia voluntaria</em>).
      </p>

      {blocked && (
        <div
          role="alert"
          className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/30"
        >
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            Has agotado tus {blocked.limit} búsquedas de hoy
          </p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            {blocked.loggedIn
              ? 'Hazte premium para tener búsquedas ilimitadas en toda la teoría legal.'
              : 'Regístrate gratis para seguir buscando (y desbloquea mucho más).'}{' '}
            Leer cualquier ley sigue siendo gratis e ilimitado.
          </p>
          <Link
            href={blocked.loggedIn ? '/premium' : '/login'}
            className="mt-3 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            {blocked.loggedIn ? 'Hazte premium' : 'Registrarme gratis'}
          </Link>
        </div>
      )}
    </form>
  )
}
