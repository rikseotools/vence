'use client'

const SUBTYPE_LABELS: Record<string, string> = {
  'sequence_numeric': 'Serie numérica',
  'sequence_letter': 'Serie alfabética',
  'sequence_alphanumeric': 'Serie alfanumérica',
  'pie_chart': 'Gráfico circular',
  'bar_chart': 'Gráfico de barras',
  'line_chart': 'Gráfico de líneas',
  'data_table': 'Tabla de datos',
  'data_tables': 'Tabla de datos',
  'mixed_chart': 'Gráfico mixto',
  'error_detection': 'Detección de errores',
  'word_analysis': 'Análisis de palabras',
  'text_question': 'Pregunta de texto',
  'calculation': 'Cálculo',
  'logic': 'Lógica',
  'synonym': 'Sinónimos',
  'antonym': 'Antónimos',
  'analogy': 'Analogía',
  'comprehension': 'Comprensión',
  'pattern': 'Patrón',
  'attention': 'Atención',
  'percentage': 'Porcentaje',
  'probability': 'Probabilidad',
  'definition': 'Definición',
  'classification': 'Clasificación',
  'alphabetical': 'Orden alfabético',
  'alphabetical_order': 'Orden alfabético',
  'code_equivalence': 'Equivalencia de códigos',
  'coding': 'Codificación'
}

interface PsychometricAIHelpButtonQuestion {
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  question_subtype?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content_data?: Record<string, any> | null
}

interface PsychometricAIHelpButtonProps {
  question: PsychometricAIHelpButtonQuestion
  questionTypeLabel?: string
  className?: string
}

// Subtypes que requieren contenido visual (gráficos, tablas, imágenes)
const VISUAL_SUBTYPES = new Set([
  'data_tables', 'pie_chart', 'bar_chart', 'line_chart', 'mixed_chart',
])

export default function PsychometricAIHelpButton({
  question,
  questionTypeLabel,
  className = ''
}: PsychometricAIHelpButtonProps) {
  // Ocultar si es un subtype visual sin datos procesables por la IA
  // (tiene image_url pero content_data vacío → la IA no puede ver la imagen)
  const isVisualSubtype = VISUAL_SUBTYPES.has(question.question_subtype || '')
  const hasProcessableData = question.content_data && Object.keys(question.content_data).length > 0
  if (isVisualSubtype && !hasProcessableData) {
    return null
  }

  const label = questionTypeLabel
    || (question.question_subtype && SUBTYPE_LABELS[question.question_subtype])
    || 'pregunta'

  const handleClick = () => {
    // Build extra context for specific question types
    let additionalContext = ''

    const isErrorDetection = question.question_subtype === 'error_detection'
      || question.content_data?.chart_type === 'error_detection'
    const isDataTable = question.question_subtype === 'data_tables'
      || !!question.content_data?.table_data

    if (isErrorDetection && question.content_data?.original_text) {
      additionalContext = `\n\nFrase a analizar: "${question.content_data.original_text}"`
    }

    if (isDataTable && question.content_data?.table_data) {
      const td = question.content_data.table_data
      const tableName = question.content_data.table_name || td.title || 'Tabla de datos'
      let tableText = `\n\n${tableName}:\n`
      if (td.headers && td.rows) {
        tableText += td.headers.join(' | ') + '\n'
        tableText += td.headers.map(() => '---').join(' | ') + '\n'
        td.rows.forEach((row: string[]) => {
          tableText += row.join(' | ') + '\n'
        })
      }
      additionalContext = tableText
    }

    window.dispatchEvent(new CustomEvent('openAIChat', {
      detail: {
        message: `Explícame paso a paso cómo resolver esta ${label}: "${question.question_text}"${additionalContext}\n\nLas opciones son:\nA) ${question.option_a}\nB) ${question.option_b}\nC) ${question.option_c}\nD) ${question.option_d}`,
        suggestion: 'explicar_psico'
      }
    }))
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-3 py-1.5 bg-blue-900 text-white rounded-lg hover:bg-blue-950 transition-colors text-sm font-medium ${className}`}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.5 2l1.5 3.5L14.5 7l-3.5 1.5L9.5 12l-1.5-3.5L4.5 7l3.5-1.5L9.5 2z"/>
        <path d="M18 8l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L14.5 11l2.5-1L18 8z"/>
      </svg>
      <span>¿Necesitas ayuda?</span>
    </button>
  )
}
