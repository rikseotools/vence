'use client'

import { useState, useEffect, useCallback } from 'react'

export default function ReviewImagesPage() {
  const [files, setFiles] = useState<string[]>([])
  const [index, setIndex] = useState(0)
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/debug/psico-images?action=list')
      .then(r => r.json())
      .then(data => {
        setFiles(data.files || [])
        setLoading(false)
      })
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault()
      setIndex(i => Math.min(i + 1, files.length - 1))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'f' || e.key === 'F') {
      // Flag como problemática
      setFlagged(prev => {
        const next = new Set(prev)
        const file = files[index]
        if (next.has(file)) next.delete(file)
        else next.add(file)
        return next
      })
    }
  }, [files, index])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p>Cargando...</p></div>

  const currentFile = files[index]
  const isFlagged = flagged.has(currentFile)

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold">Revisar Imágenes Psicotécnicas</h1>
            <span className="text-sm text-gray-400">{index + 1} / {files.length}</span>
            <span className="text-sm text-yellow-400">{flagged.size} marcadas</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <kbd className="px-2 py-1 bg-gray-700 rounded">←→</kbd> navegar
            <kbd className="px-2 py-1 bg-gray-700 rounded">F</kbd> marcar
            <kbd className="px-2 py-1 bg-gray-700 rounded">Espacio</kbd> siguiente
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-6xl mx-auto mt-2">
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${((index + 1) / files.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Imagen */}
      <div className="flex flex-col items-center p-4 max-w-6xl mx-auto">
        <div className={`relative border-4 rounded-lg overflow-hidden ${isFlagged ? 'border-red-500' : 'border-gray-700'}`}>
          {isFlagged && (
            <div className="absolute top-2 left-2 z-10 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
              MARCADA
            </div>
          )}
          <img
            src={`/api/debug/psico-images?file=${encodeURIComponent(currentFile)}`}
            alt={currentFile}
            className="max-w-full max-h-[70vh] bg-white"
            loading="eager"
          />
        </div>

        <p className="mt-3 text-sm text-gray-400 font-mono">{currentFile}</p>

        {/* Botones */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={() => setIndex(i => Math.max(i - 1, 0))}
            disabled={index === 0}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-30"
          >
            ← Anterior
          </button>
          <button
            onClick={() => {
              setFlagged(prev => {
                const next = new Set(prev)
                if (next.has(currentFile)) next.delete(currentFile)
                else next.add(currentFile)
                return next
              })
            }}
            className={`px-6 py-2 rounded-lg font-bold ${isFlagged ? 'bg-red-600 hover:bg-red-500' : 'bg-yellow-600 hover:bg-yellow-500'}`}
          >
            {isFlagged ? '✗ Desmarcar' : '⚠ Marcar (F)'}
          </button>
          <button
            onClick={() => setIndex(i => Math.min(i + 1, files.length - 1))}
            disabled={index === files.length - 1}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg disabled:opacity-30"
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Lista de marcadas */}
      {flagged.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-red-900/90 border-t border-red-700 p-3">
          <div className="max-w-6xl mx-auto">
            <p className="text-sm font-bold text-red-200 mb-1">Imágenes marcadas ({flagged.size}):</p>
            <p className="text-xs text-red-300 font-mono truncate">
              {[...flagged].join(', ')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
