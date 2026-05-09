'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import type { TemarioComparison } from '@/lib/api/oposiciones-compatibles/types'

interface OposicionOption {
  slug: string
  name: string
  shortName: string
  badge: string
}

// ============================================
// SEARCHABLE SELECT COMPONENT
// ============================================

function SearchableSelect({
  label,
  options,
  value,
  onChange,
  disabledSlug,
}: {
  label: string
  options: OposicionOption[]
  value: string
  onChange: (slug: string) => void
  disabledSlug: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.slug === value)

  const filtered = query
    ? options.filter(
        (o) =>
          o.slug !== disabledSlug &&
          (o.name.toLowerCase().includes(query.toLowerCase()) ||
            o.badge.toLowerCase().includes(query.toLowerCase()))
      )
    : options.filter((o) => o.slug !== disabledSlug)

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={open ? query : selected ? `[${selected.badge}] ${selected.name}` : ''}
        placeholder="Buscar oposición..."
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
      {/* Clear button */}
      {value && !open && (
        <button
          type="button"
          onClick={() => { onChange(''); setQuery('') }}
          className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Limpiar selección"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {open && (
        <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              Sin resultados
            </li>
          ) : (
            filtered.map((o) => (
              <li key={o.slug}>
                <button
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${
                    o.slug === value
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 font-medium text-indigo-700 dark:text-indigo-300'
                      : 'text-gray-800 dark:text-gray-200'
                  }`}
                  onClick={() => {
                    onChange(o.slug)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-1.5">
                    [{o.badge}]
                  </span>
                  {o.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

interface ComparisonResult {
  oposicionA: OposicionOption
  oposicionB: OposicionOption
  comparison: TemarioComparison
}

function getOverlapColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 40) return 'bg-amber-500'
  if (pct >= 20) return 'bg-orange-400'
  return 'bg-gray-400'
}

export default function CompararTemariosClient({
  oposiciones,
}: {
  oposiciones: OposicionOption[]
}) {
  const [slugA, setSlugA] = useState('')
  const [slugB, setSlugB] = useState('')
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const compare = useCallback(async () => {
    if (!slugA || !slugB) return
    if (slugA === slugB) {
      setError('Selecciona dos oposiciones distintas')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(
        `/api/v2/comparar-temarios?a=${encodeURIComponent(slugA)}&b=${encodeURIComponent(slugB)}`
      )
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Error al comparar')
        return
      }
      setResult(data)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }, [slugA, slugB])

  return (
    <div>
      {/* Selectors */}
      <div className="grid sm:grid-cols-[1fr,auto,1fr] gap-4 items-end mb-8">
        <SearchableSelect
          label="Oposición A"
          options={oposiciones}
          value={slugA}
          onChange={(slug) => { setSlugA(slug); setResult(null) }}
          disabledSlug={slugB}
        />

        <div className="flex items-center justify-center">
          <span className="text-2xl text-gray-400 dark:text-gray-500">&#8596;</span>
        </div>

        <SearchableSelect
          label="Oposición B"
          options={oposiciones}
          value={slugB}
          onChange={(slug) => { setSlugB(slug); setResult(null) }}
          disabledSlug={slugA}
        />
      </div>

      {/* Compare button */}
      <div className="text-center mb-8">
        <button
          onClick={compare}
          disabled={!slugA || !slugB || slugA === slugB || loading}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? 'Comparando...' : 'Comparar temarios'}
        </button>
      </div>

      {error && (
        <p className="text-center text-red-600 dark:text-red-400 mb-4">{error}</p>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-8">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {result.comparison.shared.length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leyes compartidas
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {result.comparison.sharedArticles}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Artículos compartidos
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {Math.max(
                  result.comparison.overlapPctAcoversB,
                  result.comparison.overlapPctBcoversA
                )}
                %
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Máximo solapamiento
              </div>
            </div>
          </div>

          {/* Bidirectional overlap */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Quien estudia <strong>{result.oposicionA.shortName}</strong> ya cubre de{' '}
                <strong>{result.oposicionB.shortName}</strong>:
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getOverlapColor(result.comparison.overlapPctAcoversB)}`}
                    style={{ width: `${result.comparison.overlapPctAcoversB}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {result.comparison.overlapPctAcoversB}%
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {result.comparison.sharedArticles} de{' '}
                {result.comparison.totalArticlesB} artículos
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Quien estudia <strong>{result.oposicionB.shortName}</strong> ya cubre de{' '}
                <strong>{result.oposicionA.shortName}</strong>:
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getOverlapColor(result.comparison.overlapPctBcoversA)}`}
                    style={{ width: `${result.comparison.overlapPctBcoversA}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {result.comparison.overlapPctBcoversA}%
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {result.comparison.sharedArticles} de{' '}
                {result.comparison.totalArticlesA} artículos
              </p>
            </div>
          </div>

          {/* Shared laws */}
          {result.comparison.shared.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Leyes compartidas ({result.comparison.shared.length})
              </h2>
              <div className="space-y-2">
                {result.comparison.shared.map((law) => (
                  <div
                    key={law.lawId}
                    className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 block truncate">
                        {law.lawShortName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {law.coveredArticles} de {law.totalArticles} art.
                        compartidos
                      </span>
                    </div>
                    <div className="flex-shrink-0 w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getOverlapColor(law.overlapPct)}`}
                        style={{ width: `${law.overlapPct}%` }}
                      />
                    </div>
                    <span className="flex-shrink-0 text-sm font-semibold text-gray-700 dark:text-gray-300 w-10 text-right">
                      {law.overlapPct}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Only in A / Only in B */}
          <div className="grid sm:grid-cols-2 gap-6">
            {result.comparison.onlyA.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-2">
                  Solo en {result.oposicionA.shortName} (
                  {result.comparison.onlyA.length})
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {result.comparison.onlyA.map((law) => (
                    <span
                      key={law.lawId}
                      className="text-xs px-2 py-1 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-md"
                    >
                      {law.lawShortName}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {result.comparison.onlyB.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">
                  Solo en {result.oposicionB.shortName} (
                  {result.comparison.onlyB.length})
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {result.comparison.onlyB.map((law) => (
                    <span
                      key={law.lawId}
                      className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md"
                    >
                      {law.lawShortName}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 justify-center pt-4">
            <Link
              href={`/${result.oposicionA.slug}/oposiciones-compatibles`}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Ver compatibilidad de {result.oposicionA.shortName} &rarr;
            </Link>
            <Link
              href={`/${result.oposicionB.slug}/oposiciones-compatibles`}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Ver compatibilidad de {result.oposicionB.shortName} &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
