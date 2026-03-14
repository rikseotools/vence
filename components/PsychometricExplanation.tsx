'use client'

import MarkdownExplanation from './MarkdownExplanation'

interface ExplanationSection {
  title: string
  content: string
}

interface PsychometricExplanationProps {
  verifiedExplanation?: string | null
  explanationSections?: ExplanationSection[] | null
}

/**
 * Componente centralizado para mostrar explicaciones en preguntas psicotécnicas.
 *
 * Prioridad de renderizado:
 * 1. verifiedExplanation (de la API, con markdown)
 * 2. explanationSections (de content_data, formato sección)
 * 3. Mensaje "No hay explicación disponible"
 */
export default function PsychometricExplanation({
  verifiedExplanation,
  explanationSections,
}: PsychometricExplanationProps) {
  if (verifiedExplanation) {
    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 border-green-500">
        <MarkdownExplanation
          content={verifiedExplanation}
          className="text-gray-700 dark:text-gray-300 text-sm"
        />
      </div>
    )
  }

  if (explanationSections && explanationSections.length > 0) {
    return (
      <div className="space-y-4">
        {explanationSections.map((section, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 border-blue-500">
            <h5 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
              {section.title}
            </h5>
            <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-line">
              {section.content}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border-l-4 border-gray-300 dark:border-gray-600">
      <p className="text-gray-500 dark:text-gray-400 text-sm italic">
        No hay explicación disponible para esta pregunta.
      </p>
    </div>
  )
}
