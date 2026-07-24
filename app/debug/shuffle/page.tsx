'use client'

/**
 * DEBUG (solo dev) — Demo visual del barajado + explicación estructurada (Fase 2, T-080).
 *
 * Muestra preguntas reales con las opciones BARAJADAS y la explicación renderizada desde
 * `explanation_data` (formato estructurado sin letras). Sirve para VER que:
 *   1. las opciones salen en orden distinto en cada barajado ("Barajar otra vez"),
 *   2. la explicación asigna las letras a la posición mostrada (razón sigue a su opción),
 *   3. la validación de la respuesta sigue acertando (misma coordenada mostrada→original
 *      que usa la app en serve/answer-and-save).
 *
 * Abrir en: http://localhost:3000/debug/shuffle
 */
import { useCallback, useEffect, useState } from 'react'
import MarkdownExplanation from '@/components/MarkdownExplanation'
import { permutationFor, applyOrder, displayedToOriginal } from '@/lib/shuffle/permute'
import { renderStructuredExplanation, StructuredExplanation, indexToLetter } from '@/lib/shuffle/structuredExplanation'

interface DemoQuestion {
  id: string
  question_text: string
  correct_option: number
  options: string[]
  explanation: string
  structured: StructuredExplanation
}

export default function ShuffleDebugPage() {
  const [questions, setQuestions] = useState<DemoQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [nonce, setNonce] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showNatural, setShowNatural] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch('/api/debug/shuffle-demo?n=10')
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'error')
      setQuestions(j.questions || [])
      setIdx(0)
      setNonce(0)
      setSelected(null)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <div className="p-8 text-gray-600">Cargando preguntas reales…</div>
  if (err) return <div className="p-8 text-red-600">Error: {err}</div>
  if (!questions.length) return <div className="p-8">No hay preguntas de demo.</div>

  const q = questions[idx]
  const n = q.options.length
  const order = permutationFor(q.id, `demo-${q.id}-${nonce}`, n) // order[i] = original mostrado en pos i
  const shownOptions = applyOrder(q.options, order)
  const correctDisplayPos = order.indexOf(q.correct_option)

  // Explicación renderizada desde la ESTRUCTURA con el orden barajado actual.
  const explShuffled = renderStructuredExplanation(q.structured, {
    correctOption: q.correct_option,
    optionOrder: order,
    nOptions: n,
  })
  const explNatural = renderStructuredExplanation(q.structured, {
    correctOption: q.correct_option,
    optionOrder: null,
    nOptions: n,
  })

  const answered = selected != null
  const selectedOriginal = answered ? displayedToOriginal(order, selected!) : null
  const isCorrect = answered ? selectedOriginal === q.correct_option : null

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <header className="border-b pb-3">
        <h1 className="text-xl font-bold">Demo barajado + explicación estructurada (Fase 2)</h1>
        <p className="text-sm text-gray-500">
          Pregunta {idx + 1}/{questions.length} · id <code className="text-xs">{q.id.slice(0, 8)}</code> ·
          correcta ORIGINAL = <b>{indexToLetter(q.correct_option)}</b> (índice {q.correct_option})
        </p>
      </header>

      <div className="text-base font-medium">{q.question_text}</div>

      {/* Opciones barajadas */}
      <div className="space-y-2">
        {shownOptions.map((opt, displayPos) => {
          const letter = indexToLetter(displayPos)
          let cls = 'border-gray-300 hover:border-blue-400'
          if (answered) {
            if (displayPos === correctDisplayPos) cls = 'border-green-500 bg-green-50 dark:bg-green-900/20'
            else if (displayPos === selected) cls = 'border-red-500 bg-red-50 dark:bg-red-900/20'
            else cls = 'border-gray-200 opacity-70'
          }
          return (
            <button
              key={displayPos}
              disabled={answered}
              onClick={() => setSelected(displayPos)}
              className={`w-full text-left border-2 rounded-lg px-4 py-2 flex gap-3 items-start transition-colors ${cls}`}
            >
              <span className="font-bold text-blue-600 w-5">{letter})</span>
              <span>{opt}</span>
              {answered && displayPos === correctDisplayPos && <span className="ml-auto text-green-600">✓</span>}
              {answered && displayPos === selected && displayPos !== correctDisplayPos && (
                <span className="ml-auto text-red-600">✗</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Veredicto de validación (misma coordenada que la app: mostrada→original) */}
      {answered && (
        <div
          className={`rounded-lg p-3 text-sm ${
            isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {isCorrect ? '✅ Correcto' : '❌ Incorrecto'} — elegiste la posición mostrada{' '}
          <b>{indexToLetter(selected!)}</b> → opción ORIGINAL <b>{indexToLetter(selectedOriginal!)}</b>. La
          clave (<code>correct_option={q.correct_option}</code>) mapea a la posición mostrada{' '}
          <b>{indexToLetter(correctDisplayPos)}</b>. <i>Validación idéntica a la de producción.</i>
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setNonce((v) => v + 1)
            setSelected(null)
          }}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm"
        >
          🔀 Barajar otra vez
        </button>
        <button onClick={() => setSelected(null)} className="px-3 py-1.5 bg-gray-200 rounded-lg text-sm">
          ↺ Reset respuesta
        </button>
        <button
          onClick={() => setShowNatural((v) => !v)}
          className="px-3 py-1.5 bg-gray-200 rounded-lg text-sm"
        >
          {showNatural ? 'Ocultar' : 'Ver'} orden natural (comparar «es igual»)
        </button>
        <button
          onClick={() => {
            setIdx((v) => (v + 1) % questions.length)
            setNonce(0)
            setSelected(null)
          }}
          className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-sm ml-auto"
        >
          Siguiente pregunta →
        </button>
      </div>

      <div className="text-xs text-gray-500">
        Orden mostrado (pos→original):{' '}
        {order.map((o, i) => `${indexToLetter(i)}=${indexToLetter(o)}`).join('  ')}
      </div>

      {/* Explicación renderizada desde la estructura, con las letras de la posición barajada */}
      <div className="border rounded-lg p-4 bg-blue-50/40 dark:bg-blue-900/10">
        <div className="text-xs font-semibold text-gray-500 mb-1">
          Explicación (render desde explanation_data · orden BARAJADO actual)
        </div>
        <MarkdownExplanation content={explShuffled} className="text-sm text-blue-800 dark:text-blue-300" />
      </div>

      {showNatural && (
        <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800/40">
          <div className="text-xs font-semibold text-gray-500 mb-1">
            Explicación (render en ORDEN NATURAL — así se ve hoy sin barajar)
          </div>
          <MarkdownExplanation content={explNatural} className="text-sm text-gray-700 dark:text-gray-300" />
          <details className="mt-2">
            <summary className="text-xs text-gray-400 cursor-pointer">explanation original en BD (§8.1)</summary>
            <pre className="text-xs whitespace-pre-wrap mt-1 text-gray-500">{q.explanation}</pre>
          </details>
        </div>
      )}
    </div>
  )
}
