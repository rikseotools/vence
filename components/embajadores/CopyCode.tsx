'use client'
// components/embajadores/CopyCode.tsx
// Campo copiable: [label] [valor en mono] [botón Copiar] (verde al copiar). Copia SOLO ese valor.
// Se usa para cada campo del vale (Código / PIN / Serial), cada uno con su propio botón.

import { useState } from 'react'

export default function CopyCode({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* noop */ }
  }
  return (
    <div className="flex items-center gap-2">
      {label ? <span className="text-xs text-gray-500 dark:text-gray-400 w-16 shrink-0">{label}</span> : null}
      <code className="flex-1 text-sm font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5 select-all break-all">{value}</code>
      <button
        onClick={copy}
        title={`Copiar ${label || 'valor'}`}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition ${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {copied ? '✓' : 'Copiar'}
      </button>
    </div>
  )
}
