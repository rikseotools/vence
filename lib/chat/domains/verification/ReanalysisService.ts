// lib/chat/domains/verification/ReanalysisService.ts
// Servicio para re-analizar preguntas psicotécnicas con modelo superior

import OpenAI from 'openai'
import { logger } from '../../shared/logger'

const REANALYSIS_MODEL = 'gpt-4o'

interface ReanalysisInput {
  questionText: string
  options: { a: string; b: string; c: string; d: string }
  correctAnswer: string // A, B, C, D
  aiSuggestedAnswer: string // Lo que sugirió el modelo inicial
  originalAnalysis: string
  questionTypeName?: string
  questionSubtype?: string
  contentData?: Record<string, unknown>
}

interface ReanalysisResult {
  analysis: string
  model: string
  tokensUsed?: number
}

/**
 * Re-analiza una pregunta psicotécnica con el modelo superior (gpt-4o)
 * cuando el análisis inicial (gpt-4o-mini) sugirió una respuesta diferente a la BD
 */
export async function reanalyzeWithSuperiorModel(
  input: ReanalysisInput
): Promise<ReanalysisResult> {
  const openai = new OpenAI()

  logger.info('Starting reanalysis with superior model', {
    domain: 'verification',
    model: REANALYSIS_MODEL,
    questionType: input.questionTypeName,
    aiSuggested: input.aiSuggestedAnswer,
    dbAnswer: input.correctAnswer
  })

  // Formatear datos adicionales si existen
  let dataContext = ''
  if (input.contentData) {
    dataContext = formatContentData(input.contentData, input.questionSubtype)
  }

  const systemPrompt = `Eres un experto en psicotécnicos y razonamiento lógico. Se te pide re-analizar una pregunta donde hubo discrepancia entre un análisis previo y la respuesta correcta registrada en base de datos.

Tu tarea es:
1. Analizar la pregunta paso a paso con rigor
2. Verificar cuál es la respuesta correcta basándote en los datos
3. Explicar el razonamiento de forma clara y pedagógica
4. Si la respuesta de la BD es correcta, explicar por qué el análisis previo pudo equivocarse
5. Si detectas que la BD podría estar equivocada, indicarlo claramente

Responde en español. Sé conciso pero completo. NO menciones nombres de modelos de IA.`

  const userPrompt = `PREGUNTA PSICOTÉCNICA:
${input.questionText}

OPCIONES:
A) ${input.options.a}
B) ${input.options.b}
C) ${input.options.c}
D) ${input.options.d}
${dataContext ? `\nDATOS ADICIONALES:\n${dataContext}` : ''}

SITUACIÓN:
- La respuesta correcta según la base de datos es: ${input.correctAnswer}
- Un análisis previo sugirió que la respuesta sería: ${input.aiSuggestedAnswer}

ANÁLISIS PREVIO (puede contener errores):
${input.originalAnalysis.substring(0, 1500)}

Por favor, analiza paso a paso esta pregunta y explica cuál es la respuesta correcta y por qué. Si el análisis previo se equivocó, explica dónde estuvo el error de razonamiento.`

  try {
    const response = await openai.chat.completions.create({
      model: REANALYSIS_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2, // Baja temperatura para más consistencia
      max_tokens: 1200
    })

    const analysis = response.choices[0].message.content || ''
    const tokensUsed = response.usage?.total_tokens

    logger.info('Reanalysis completed', {
      domain: 'verification',
      tokensUsed,
      responseLength: analysis.length
    })

    return {
      analysis,
      model: REANALYSIS_MODEL,
      tokensUsed
    }
  } catch (error) {
    logger.error('Error in reanalysis', error, { domain: 'verification' })
    throw error
  }
}

/**
 * Formatea los datos de contenido según el tipo de pregunta
 */
function formatContentData(
  contentData: Record<string, unknown>,
  questionSubtype?: string
): string {
  let formatted = ''

  // Gráficos de líneas/barras
  if (questionSubtype === 'line_chart' || questionSubtype === 'bar_chart' || questionSubtype === 'mixed_chart') {
    if (contentData.chart_title) {
      formatted += `Título: ${contentData.chart_title}\n`
    }
    if (contentData.categories && contentData.age_groups) {
      const categories = contentData.categories as string[]
      formatted += `Categorías (eje X): ${categories.join(', ')}\n`
      formatted += 'Datos por serie:\n'
      const ageGroups = contentData.age_groups as Array<{ label: string; values: number[] }>
      ageGroups.forEach(group => {
        formatted += `  • ${group.label}: ${group.values.join(', ')}\n`
      })
    } else if (contentData.chart_data) {
      formatted += 'Datos del gráfico:\n'
      const chartData = contentData.chart_data as Array<Record<string, unknown>>
      if (Array.isArray(chartData)) {
        chartData.forEach(item => {
          if (item.label && item.value !== undefined) {
            formatted += `  • ${item.label}: ${item.value}\n`
          } else if (item.category && item.values) {
            formatted += `  • ${item.category}: ${(item.values as unknown[]).join(', ')}\n`
          }
        })
      }
    }
  }

  // Gráfico circular
  else if (questionSubtype === 'pie_chart') {
    if (contentData.chart_title) {
      formatted += `Título: ${contentData.chart_title}\n`
    }
    if (contentData.total_value) {
      formatted += `Total: ${contentData.total_value}\n`
    }
    if (contentData.chart_data && Array.isArray(contentData.chart_data)) {
      formatted += 'Sectores:\n'
      const chartData = contentData.chart_data as Array<{ label?: string; name?: string; value: unknown; percentage?: number }>
      chartData.forEach(item => {
        const name = item.label || item.name
        formatted += `  • ${name}: ${item.value}${item.percentage ? ` (${item.percentage}%)` : ''}\n`
      })
    }
  }

  // Tablas de datos
  else if (questionSubtype === 'data_tables') {
    if (contentData.table_title) {
      formatted += `Tabla: ${contentData.table_title}\n`
    }
    if (contentData.context) {
      formatted += `Contexto: ${contentData.context}\n`
    }
    if (contentData.table_data) {
      formatted += 'Datos de la tabla:\n'
      if (Array.isArray(contentData.table_data)) {
        const tableData = contentData.table_data as Array<Record<string, unknown>>
        tableData.forEach((row, i) => {
          formatted += `  Fila ${i + 1}: ${JSON.stringify(row)}\n`
        })
      } else {
        formatted += `  ${JSON.stringify(contentData.table_data)}\n`
      }
    }
  }

  // Series numéricas/letras
  else if (questionSubtype?.startsWith('sequence_')) {
    if (contentData.pattern_type) {
      formatted += `Tipo de patrón: ${contentData.pattern_type}\n`
    }
    if (contentData.solution_method) {
      formatted += `Método de solución: ${contentData.solution_method}\n`
    }
  }

  // Detección de errores
  else if (questionSubtype === 'error_detection') {
    if (contentData.original_text) {
      formatted += `Texto original: ${contentData.original_text}\n`
    }
    if (contentData.error_count) {
      formatted += `Número de errores: ${contentData.error_count}\n`
    }
  }

  // Si no hay formato específico, serializar JSON
  else if (Object.keys(contentData).length > 0) {
    formatted = JSON.stringify(contentData, null, 2)
  }

  return formatted
}
