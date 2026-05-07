// utils/formatArticleContent.ts
// Utilidades de formato de artículos legales para HTML

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
