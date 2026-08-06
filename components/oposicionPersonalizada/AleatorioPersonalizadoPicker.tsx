// components/oposicionPersonalizada/AleatorioPersonalizadoPicker.tsx — picker + runner del test
// aleatorio multi-tema de una oposición personalizada. (T-327)
//
// Un solo componente hace las DOS cosas (elegir temas, y luego correr el test) para no tener que
// inventar una URL intermedia ni tocar `/test/personalizado` (que SÍ depende del config estático
// y es compartida por todo el catálogo — cambiarla es más riesgo del que hace falta aquí).
'use client'

import { useState } from 'react'
import TestPageWrapper from '@/components/TestPageWrapper'

interface Tema {
  topicNumber: number
  title: string
  preguntas: number
}

interface Props {
  personalizadaId: string
  nombre: string
  /** Ya vienen filtrados a los que SÍ tienen preguntas — ver la página servidor. */
  temas: Tema[]
}

const OPCIONES_N = [10, 20, 30, 50]

export default function AleatorioPersonalizadoPicker({ personalizadaId, nombre, temas }: Props) {
  const [seleccionados, setSeleccionados] = useState<Set<number>>(
    () => new Set(temas.map((t) => t.topicNumber)),
  )
  const [numQuestions, setNumQuestions] = useState(20)
  const [difficulty, setDifficulty] = useState<'mixed' | 'easy' | 'medium' | 'hard'>('mixed')
  const [enMarcha, setEnMarcha] = useState(false)

  const positionType = `personalizada_${personalizadaId}`
  const temasSeleccionados = temas.filter((t) => seleccionados.has(t.topicNumber))
  const preguntasDisponibles = temasSeleccionados.reduce((n, t) => n + t.preguntas, 0)

  if (enMarcha) {
    return (
      <TestPageWrapper
        testType="aleatorio"
        themes={[...seleccionados]}
        positionType={positionType}
        defaultConfig={{
          positionType,
          numQuestions,
          difficulty,
          testMode: 'practice',
          adaptiveMode: false,
        }}
        customTitle={`Test aleatorio · ${nombre}`}
        customSubtitle={`${temasSeleccionados.length} tema(s)`}
        customIcon="🎲"
        customColor="from-blue-500 to-indigo-600"
      />
    )
  }

  const toggle = (n: number) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  }

  const todosMarcados = seleccionados.size === temas.length

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Temas</h2>
          <button
            type="button"
            onClick={() =>
              setSeleccionados(todosMarcados ? new Set() : new Set(temas.map((t) => t.topicNumber)))
            }
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {todosMarcados ? 'Quitar todos' : 'Marcar todos'}
          </button>
        </div>
        <ul className="space-y-2">
          {temas.map((t) => (
            <li key={t.topicNumber}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seleccionados.has(t.topicNumber)}
                  onChange={() => toggle(t.topicNumber)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
                  {t.topicNumber}. {t.title}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t.preguntas} pregunta(s)
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Número de preguntas</h2>
        <div className="flex gap-2 flex-wrap">
          {OPCIONES_N.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNumQuestions(n)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                numQuestions === n
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Dificultad</h2>
        <div className="flex gap-2 flex-wrap">
          {(
            [
              ['mixed', 'Mixta'],
              ['easy', 'Fácil'],
              ['medium', 'Media'],
              ['hard', 'Difícil'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDifficulty(value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                difficulty === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={seleccionados.size === 0}
        onClick={() => setEnMarcha(true)}
        className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {seleccionados.size === 0
          ? 'Elige al menos un tema'
          : `Empezar test (${Math.min(numQuestions, preguntasDisponibles)} preguntas)`}
      </button>
    </div>
  )
}
