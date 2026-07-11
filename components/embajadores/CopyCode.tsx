'use client'
// components/embajadores/CopyCode.tsx
// Código de vale con botón "Copiar" (se pone verde al copiar). Copia SOLO el código (lo que se pega
// en Amazon), no el PIN/serial. Reutilizado en "Mis vales" del usuario y en la vista admin.

import { useState } from 'react'

export default function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* noop */ }
  }
  return (
    <div className="flex items-center gap-2">
      <code className="text-sm font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5 select-all break-all">{code}</code>
      <button
        onClick={copy}
        title="Copiar el código"
        className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold text-white transition ${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {copied ? '¡Copiado! ✓' : 'Copiar'}
      </button>
    </div>
  )
}
