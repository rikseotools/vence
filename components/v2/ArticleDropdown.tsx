// components/v2/ArticleDropdown.tsx
// Componente desplegable para mostrar artículo completo con resaltado inteligente
'use client'
import { useState, useRef } from 'react'

interface ArticleData {
  article_number?: string | null
  display_number?: string | null
  title?: string | null
  full_text?: string | null
  content?: string | null
  law_short_name?: string | null
}

interface CurrentQuestion {
  question?: string
  correct?: number
  options?: string[]
}

interface ArticleDropdownProps {
  article: ArticleData
  currentQuestion?: CurrentQuestion
}

// Función para extraer palabras clave de la pregunta y respuesta correcta
export function extractKeywords(question: string | undefined, correctAnswer: number | undefined, options: string[] | undefined): string[] {
  const keywords = new Set<string>()

  // Extraer palabras clave de la pregunta (filtrar palabras comunes)
  const questionWords = question
    ?.toLowerCase()
    .replace(/[¿?¡!,.:;]/g, ' ')
    .split(/\s+/)
    .filter(word =>
      word.length > 3 &&
      !['tienen', 'como', 'para', 'sobre', 'entre', 'según', 'donde', 'cuando', 'cual', 'esta', 'este', 'estos', 'estas', 'pero', 'sino', 'aunque'].includes(word)
    ) || []

  questionWords.forEach(word => keywords.add(word))

  // Extraer palabras clave de la respuesta correcta
  const correctAnswerText = correctAnswer !== undefined ? options?.[correctAnswer] : undefined
  if (correctAnswerText) {
    const answerWords = correctAnswerText
      .toLowerCase()
      .replace(/[,.:;]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)

    answerWords.forEach(word => keywords.add(word))
  }

  return Array.from(keywords).filter(word => word.length > 2)
}

// Función para formatear texto plano a HTML legible con resaltado inteligente
export function formatTextContent(content: string | undefined | null, question: string | undefined, correctAnswer: number | undefined, options: string[] | undefined): string {
  if (!content) return 'Contenido no disponible'

  let formattedContent = content
    // Convertir saltos de línea a <br>
    .replace(/\n/g, '<br>')
    // Convertir números de punto (1., 2., etc.) en párrafos numerados
    .replace(/(\d+\.\s)/g, '<br><strong>$1</strong>')
    // Convertir letras de punto (a), b), etc.) en sub-párrafos
    .replace(/([a-z]\)\s)/g, '<br>&nbsp;&nbsp;<strong>$1</strong>')
    // Agregar espaciado después de puntos finales seguidos de mayúscula
    .replace(/\.\s+(?=[A-Z])/g, '.<br><br>')
    // Limpiar múltiples <br> consecutivos
    .replace(/(<br>\s*){3,}/g, '<br><br>')
    // Limpiar <br> al inicio
    .replace(/^(<br>\s*)+/, '')

  // Resaltar específicamente partes clave según el tipo de pregunta

  // Para preguntas sobre alto cargo
  if (question?.toLowerCase().includes('alto cargo') || question?.toLowerCase().includes('condición')) {
    const specificHighlights = [
      {
        pattern: /(Los órganos superiores y directivos tienen además la condición de alto cargo, excepto los Subdirectores generales y asimilados[^.]*\.)/gi,
        replacement: '<mark style="background-color: #fef3c7; padding: 3px 6px; border-radius: 4px; font-weight: bold; color: #92400e; border-left: 4px solid #f59e0b;">🎯 $1</mark>'
      },
      {
        pattern: /(excepto los Subdirectores generales y asimilados)/gi,
        replacement: '<mark style="background-color: #fee2e2; padding: 2px 4px; border-radius: 3px; font-weight: bold; color: #dc2626;">⚠️ $1</mark>'
      }
    ]

    specificHighlights.forEach(({ pattern, replacement }) => {
      formattedContent = formattedContent.replace(pattern, replacement)
    })
  }

  // Para preguntas sobre organización/estructura
  if (question?.toLowerCase().includes('órganos') || question?.toLowerCase().includes('organización')) {
    const organizationHighlights = [
      {
        pattern: /(Órganos superiores:[^b]*)/gi,
        replacement: '<mark style="background-color: #ddd6fe; padding: 2px 4px; border-radius: 3px; color: #5b21b6;">$1</mark>'
      },
      {
        pattern: /(Órganos directivos:[^\.]*\.)/gi,
        replacement: '<mark style="background-color: #dcfce7; padding: 2px 4px; border-radius: 3px; color: #166534;">$1</mark>'
      }
    ]

    organizationHighlights.forEach(({ pattern, replacement }) => {
      formattedContent = formattedContent.replace(pattern, replacement)
    })
  }

  // Resaltar términos específicos de la pregunta de forma más sutil
  const keywords = extractKeywords(question, correctAnswer, options)
  keywords.forEach(keyword => {
    if (keyword.length > 4 && !formattedContent.includes('<mark') && !formattedContent.includes('style="background-color: #fef3c7')) {
      const regex = new RegExp(`\\b(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi')
      formattedContent = formattedContent.replace(regex, (match) => {
        return `<span style="background-color: #e0f2fe; padding: 1px 2px; border-radius: 2px; color: #0277bd;">${match}</span>`
      })
    }
  })

  // Resaltar referencias a leyes y normativas
  formattedContent = formattedContent
    .replace(/(Ley\s+\d+\/\d+)/gi, '<strong style="color: #2563eb; background-color: #eff6ff; padding: 1px 3px; border-radius: 2px;">📋 $1</strong>')
    .replace(/(Real Decreto\s+\d+\/\d+)/gi, '<strong style="color: #16a34a; background-color: #f0fdf4; padding: 1px 3px; border-radius: 2px;">📜 $1</strong>')
    .replace(/(artículo\s+\d+)/gi, '<strong style="color: #9333ea; background-color: #faf5ff; padding: 1px 3px; border-radius: 2px;">📄 $1</strong>')

  return formattedContent
}

export default function ArticleDropdown({ article, currentQuestion }: ArticleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // No mostrar si no hay contenido del artículo
  if (!article.full_text && !article.content) {
    return null
  }

  const hasSpecialHighlights = currentQuestion?.question?.toLowerCase().includes('alto cargo') ||
                               currentQuestion?.question?.toLowerCase().includes('órganos')

  return (
    <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg mt-4">
      {/* Header clickeable */}
      <button
        onClick={() => {
          const willOpen = !isOpen
          setIsOpen(willOpen)
          if (willOpen) {
            setTimeout(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
          }
        }}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors rounded-lg"
      >
        <div className="flex items-center space-x-2">
          <span className="text-lg">📚</span>
          <h4 className="font-bold text-gray-800 dark:text-gray-200">
            Ver Artículo Completo: {article.display_number || article.article_number}
          </h4>
          {/* Indicador de contenido relevante */}
          <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full">
            🎯 Contiene respuesta
          </span>
        </div>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Contenido desplegable con formato mejorado */}
      {isOpen && (
        <div ref={contentRef} className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600">

          {/* Título del artículo */}
          {article.title && (
            <div className="mt-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
              <h5 className="font-bold text-blue-800 dark:text-blue-300 text-sm">
                📋 {article.title}
              </h5>
            </div>
          )}

          {/* Leyenda de colores - solo si hay resaltados */}
          {hasSpecialHighlights && (
            <div className="mt-3 mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <h6 className="font-bold text-amber-800 dark:text-amber-300 text-xs mb-2">🎯 Guía de lectura:</h6>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="flex items-center space-x-1">
                  <span style={{backgroundColor: '#fef3c7', padding: '1px 4px', borderRadius: '2px', color: '#92400e', fontWeight: 'bold'}}>■</span>
                  <span className="text-amber-700 dark:text-amber-400">Respuesta directa</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span style={{backgroundColor: '#fee2e2', padding: '1px 4px', borderRadius: '2px', color: '#dc2626', fontWeight: 'bold'}}>■</span>
                  <span className="text-amber-700 dark:text-amber-400">Excepciones clave</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span style={{backgroundColor: '#e0f2fe', padding: '1px 4px', borderRadius: '2px', color: '#0277bd'}}>■</span>
                  <span className="text-amber-700 dark:text-amber-400">Términos relacionados</span>
                </span>
              </div>
            </div>
          )}

          {/* Contenido del artículo con formato mejorado */}
          <div className="mt-3">
            <div
              className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed space-y-2"
              dangerouslySetInnerHTML={{
                __html: formatTextContent(
                  article.full_text || article.content,
                  currentQuestion?.question,
                  currentQuestion?.correct,
                  currentQuestion?.options
                )
              }}
            />
          </div>

          {/* Información adicional del artículo */}
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 dark:text-gray-400">
              <div>
                <span className="font-medium">📖 Ley:</span> {article.law_short_name || 'N/A'}
              </div>
              <div>
                <span className="font-medium">📄 Artículo:</span> {article.article_number || article.display_number}
              </div>
            </div>

            {/* Tip para el usuario */}
            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded text-xs text-blue-700 dark:text-blue-400">
              💡 <strong>Tip:</strong> Lee las partes resaltadas para encontrar rápidamente la respuesta. Los colores te ayudan a identificar la información clave.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
