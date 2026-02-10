// lib/services/questionGenerator.js
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export class QuestionGenerator {
  constructor() {
    this.difficultyPrompts = {
      alta: {
        instructions: "Genera preguntas de dificultad ALTA que requieren análisis e interpretación de los artículos. Enfócate en relaciones entre artículos, implicaciones jurídicas y conocimiento detallado.",
        complexity: "Análisis jurídico, interpretación constitucional, relaciones entre normas"
      },
      muy_alta: {
        instructions: "Genera preguntas de dificultad MUY ALTA para expertos en Derecho Constitucional. Incluye doctrina, jurisprudencia, tensiones dialécticas y hermenéutica constitucional avanzada.",
        complexity: "Interpretación dogmática, tensiones constitucionales, análisis hermenéutico experto"
      }
    }
  }

  async getArticulosByTitulo(tituloNombre) {
    const { data, error } = await getSupabase()
      .rpc('get_articulos_por_titulo', { titulo_nombre: tituloNombre })
    
    if (error) {
      console.error('Error fetching articles:', error)
      throw new Error('No se pudieron obtener los artículos')
    }
    
    return data
  }

  async generateQuestions(tituloNombre, dificultad, numPreguntas = 20) {
    try {
      // 1. Obtener artículos del título
      const articulos = await this.getArticulosByTitulo(tituloNombre)
      
      if (articulos.length === 0) {
        throw new Error(`No se encontraron artículos para el título: ${tituloNombre}`)
      }

      // 2. Preparar contexto para IA
      const articulosTexto = articulos.map(art => 
        `Artículo ${art.numero}: ${art.texto}`
      ).join('\n\n')

      // 3. Crear prompt específico por dificultad
      const difficultyConfig = this.difficultyPrompts[dificultad]
      
      const prompt = this.buildPrompt(articulosTexto, difficultyConfig, numPreguntas, dificultad)

      // 4. Llamar a OpenAI
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "Eres un experto en Derecho Constitucional español especializado en crear preguntas de test para oposiciones y formación jurídica avanzada."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      })

      // 5. Parsear respuesta
      const response = JSON.parse(completion.choices[0].message.content)
      
      // 6. Validar y formatear preguntas
      const questions = this.validateAndFormatQuestions(response.questions, articulos)
      
      return {
        questions,
        metadata: {
          titulo: tituloNombre,
          dificultad,
          articulosUsados: articulos.length,
          generatedAt: new Date().toISOString()
        }
      }

    } catch (error) {
      console.error('Error generating questions:', error)
      throw new Error(`Error al generar preguntas: ${error.message}`)
    }
  }

  buildPrompt(articulosTexto, difficultyConfig, numPreguntas, dificultad) {
    return `
**TAREA**: Genera ${numPreguntas} preguntas de test sobre estos artículos de la Constitución Española.

**DIFICULTAD**: ${dificultad.toUpperCase()}
${difficultyConfig.instructions}

**CRITERIOS ESPECÍFICOS**:
- ${difficultyConfig.complexity}
- Preguntas originales y únicas
- 4 opciones de respuesta por pregunta
- Una sola respuesta correcta
- Explicaciones detalladas y técnicamente precisas
- Referencia específica al artículo constitucional

**ARTÍCULOS CONSTITUCIONALES**:
${articulosTexto}

**FORMATO DE RESPUESTA** (JSON estricto):
{
  "questions": [
    {
      "question": "¿Pregunta técnicamente precisa?",
      "options": [
        "Opción A - realista y técnica",
        "Opción B - realista y técnica", 
        "Opción C - realista y técnica",
        "Opción D - realista y técnica"
      ],
      "correct": 0,
      "explanation": "Explicación técnica detallada que justifica la respuesta correcta con fundamento doctrinal",
      "articleRef": "1.1",
      "difficulty": "${dificultad}",
      "keywords": ["palabra1", "palabra2", "palabra3"]
    }
  ]
}

**IMPORTANTE**: 
- Devuelve SOLO el JSON sin texto adicional
- Asegúrate de que el JSON sea válido
- Las explicaciones deben ser técnicamente rigurosas
- Varía la complejidad y enfoque de las preguntas
- Evita preguntas obvias o triviales
`
  }

  validateAndFormatQuestions(questions, articulos) {
    const articulosMap = new Map(
      articulos.map(art => [art.numero, art])
    )

    return questions.filter(q => {
      // Validaciones básicas
      if (!q.question || !q.options || !Array.isArray(q.options) || q.options.length !== 4) {
        console.warn('Pregunta inválida (formato):', q)
        return false
      }
      
      if (typeof q.correct !== 'number' || q.correct < 0 || q.correct > 3) {
        console.warn('Pregunta inválida (respuesta correcta):', q)
        return false
      }

      if (!q.explanation || !q.articleRef) {
        console.warn('Pregunta inválida (explicación/referencia):', q)
        return false
      }

      // Añadir texto completo del artículo referenciado
      const articulo = articulosMap.get(q.articleRef)
      if (articulo) {
        q.article = {
          number: `Artículo ${articulo.numero}`,
          text: articulo.texto
        }
      }

      return true
    }).map((q, index) => ({
      ...q,
      id: `q_${Date.now()}_${index}`,
      timestamp: new Date().toISOString()
    }))
  }

  async saveGeneratedTest(testData, sessionId, userId = null) {
    const { data, error } = await getSupabase()
      .from('tests_generados')
      .insert({
        user_id: userId,
        session_id: sessionId,
        titulo_id: testData.tituloId,
        dificultad: testData.dificultad,
        preguntas: testData.questions,
        completado: false
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving test:', error)
      throw new Error('No se pudo guardar el test')
    }

    return data
  }

  async updateTestResults(testId, respuestas, score, tiempoTotal) {
    const { error } = await getSupabase()
      .from('tests_generados')
      .update({
        respuestas,
        score,
        tiempo_total: tiempoTotal,
        completado: true,
        completed_at: new Date().toISOString()
      })
      .eq('id', testId)

    if (error) {
      console.error('Error updating test results:', error)
      throw new Error('No se pudieron guardar los resultados')
    }
  }

  async getUserTestHistory(userId, sessionId) {
    let query = getSupabase()
      .from('tests_generados')
      .select(`
        id,
        dificultad,
        score,
        completado,
        created_at,
        completed_at,
        titulos(nombre)
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (userId) {
      query = query.eq('user_id', userId)
    } else if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching test history:', error)
      return []
    }

    return data
  }
}

// Instancia singleton
export const questionGenerator = new QuestionGenerator()