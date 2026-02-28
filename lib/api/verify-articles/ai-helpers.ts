// lib/api/verify-articles/ai-helpers.ts - Helpers de IA para verificación de artículos

// ============================================
// MODEL CONFIGURATION
// ============================================

const MAX_OUTPUT_TOKENS: Record<string, number> = {
  'claude-3-haiku-20240307': 4096,
  'claude-sonnet-4-20250514': 8192,
  'claude-sonnet-4-5-20250929': 8192,
  'gpt-4o-mini': 16384,
  'gpt-4o': 16384,
  'gpt-4-turbo': 4096,
  'gemini-1.5-flash': 8192,
  'gemini-1.5-flash-8b': 8192,
  'gemini-1.5-pro': 8192,
  'gemini-2.0-flash-exp': 8192,
}

const MODEL_BATCH_LIMITS: Record<string, number> = {
  'claude-3-haiku-20240307': 4,
  'claude-sonnet-4-20250514': 10,
  'claude-sonnet-4-5-20250929': 10,
  'gpt-4o-mini': 18,
  'gpt-4o': 18,
  'gpt-4-turbo': 4,
  'gemini-1.5-flash': 10,
  'gemini-1.5-flash-8b': 10,
  'gemini-1.5-pro': 10,
  'gemini-2.0-flash-exp': 10,
}

export function getMaxOutputTokens(model: string): number {
  return MAX_OUTPUT_TOKENS[model] || 4096
}

export function getSafeBatchSize(model: string): number {
  return MODEL_BATCH_LIMITS[model] || 4
}

export { MODEL_BATCH_LIMITS }

// ============================================
// AI CONFIG
// ============================================

interface AIConfig {
  apiKey: string | undefined
  model: string
  isActive: boolean
}

const ENV_KEYS: Record<string, string | undefined> = {
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_AI_API_KEY,
}

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-1.5-flash',
}

export function getAIConfigFromEnv(provider: string): AIConfig {
  return {
    apiKey: ENV_KEYS[provider],
    model: DEFAULT_MODELS[provider] || 'gpt-4o-mini',
    isActive: !!ENV_KEYS[provider],
  }
}

export function decryptApiKey(encrypted: string): string {
  return Buffer.from(encrypted, 'base64').toString('utf-8')
}

export function normalizeProvider(provider: string): string {
  return provider === 'claude' ? 'anthropic' : provider
}

// ============================================
// PROMPT BUILDERS
// ============================================

interface Question {
  id: string
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: number
  explanation: string | null
}

export function buildBatchVerificationPrompt(params: {
  lawName: string
  articleNumber: string
  articleContent: string
  questions: Question[]
}): string {
  const { lawName, articleNumber, articleContent, questions: qs } = params

  const questionsText = qs.map((q, i) => {
    const correctLetter = ['A', 'B', 'C', 'D'][q.correctOption]
    return `
### Pregunta ${i + 1} (ID: ${q.id})
${q.questionText}

A) ${q.optionA}
B) ${q.optionB}
C) ${q.optionC}
D) ${q.optionD}

Respuesta marcada como correcta: ${correctLetter}
Explicación actual: ${q.explanation || 'No disponible'}
`
  }).join('\n---\n')

  return `Eres un experto en derecho administrativo español. Tu tarea es verificar si las siguientes preguntas de examen de oposiciones son correctas basándote en el contenido LITERAL del artículo de la ley.

## ARTÍCULO OFICIAL DEL BOE
Ley: ${lawName}
Artículo ${articleNumber}:

${articleContent}

## PREGUNTAS A VERIFICAR (${qs.length} preguntas)

${questionsText}

## TU ANÁLISIS

Para CADA pregunta, verifica:
1. Si la respuesta marcada como correcta es realmente correcta según el artículo LITERAL del BOE
2. Si las otras opciones son claramente incorrectas
3. Si la explicación es correcta

Responde en formato JSON con este esquema exacto:
{
  "verifications": [
    {
      "questionId": "uuid-de-la-pregunta",
      "isCorrect": true/false,
      "confidence": "alta/media/baja",
      "explanation": "Tu análisis interno sobre por qué la respuesta es correcta o incorrecta",
      "articleQuote": "Cita LITERAL del artículo del BOE que justifica la respuesta",
      "suggestedFix": "Descripción del error si lo hay. null si está bien",
      "correctOptionShouldBe": "A/B/C/D si hay error, null si está bien",
      "newExplanation": "OBLIGATORIO - Explicación DIDÁCTICA y COMPLETA para el alumno. Estructura:\\n\\n1. FUNDAMENTO LEGAL: Cita SIEMPRE el artículo completo con su apartado específico y la ley. Ejemplos correctos:\\n   - 'El artículo 3.5 de la Ley 39/2015 establece que...'\\n   - 'Según el artículo 21.2.a) de la Ley 39/2015 del Procedimiento Administrativo Común...'\\n   - 'El apartado 3 del artículo 53 de la Ley 39/2015 dispone...'\\n   NUNCA digas solo 'El artículo establece...' sin especificar número, apartado y ley.\\n\\n2. RESPUESTA CORRECTA: Explica POR QUÉ es correcta citando el texto literal del artículo entre comillas.\\n\\n3. ANÁLISIS DE OPCIONES INCORRECTAS: Explica brevemente por qué cada opción incorrecta no es válida.\\n\\n4. CONSEJO PRÁCTICO: Un truco nemotécnico o relación con otros conceptos para recordarlo.\\n\\nIMPORTANTE: Sé claro, pedagógico y preciso. El alumno debe entender el concepto legal, no solo memorizar."
    }
  ]
}

IMPORTANTE:
- Devuelve exactamente ${qs.length} verificaciones, una por pregunta
- Mantén el orden de las preguntas
- Usa los IDs de pregunta proporcionados
- El campo "newExplanation" es OBLIGATORIO y debe ser DIDÁCTICO Y EXTENSO (mínimo 200 palabras)
- NO ALUCINES: si algo no está en el artículo, no lo inventes
- Las citas entre comillas deben ser EXACTAS del texto proporcionado arriba
- Si no puedes verificar algo con el artículo dado, indícalo claramente
- El objetivo es ENSEÑAR al alumno, no solo indicar si está bien o mal

FORMATO JSON CRÍTICO:
- Devuelve SOLO el JSON, sin texto antes ni después
- Los saltos de línea dentro de strings DEBEN ser \\n (escapados), NUNCA saltos de línea literales
- Ejemplo correcto: "explanation": "Primera línea.\\n\\nSegunda línea."
- Ejemplo INCORRECTO: "explanation": "Primera línea.
Segunda línea."
- El JSON debe ser válido y parseable directamente`
}

export function buildSingleVerificationPrompt(params: {
  lawName: string
  articleNumber: string
  articleContent: string
  questionText: string
  options: { a: string; b: string; c: string; d: string }
  correctOption: string
  correctAnswer: string
  explanation: string | null
}): string {
  const { lawName, articleNumber, articleContent, questionText, options, correctOption, correctAnswer, explanation } = params

  return `Eres un experto en derecho administrativo español. Tu tarea es verificar si una pregunta de examen de oposiciones es correcta basándote en el contenido LITERAL del artículo de la ley.

## ARTÍCULO OFICIAL DEL BOE
Ley: ${lawName}
Artículo ${articleNumber}:
${articleContent}

## PREGUNTA A VERIFICAR
${questionText}

A) ${options.a}
B) ${options.b}
C) ${options.c}
D) ${options.d}

Respuesta marcada como correcta: ${correctOption}) ${correctAnswer}

## EXPLICACIÓN ACTUAL
${explanation || 'No hay explicación disponible'}

## TU ANÁLISIS
Analiza si:
1. La respuesta marcada como correcta (${correctOption}) es realmente correcta según el artículo LITERAL del BOE
2. Las otras opciones son claramente incorrectas
3. La explicación es correcta y didáctica

Responde en formato JSON exactamente así:
{
  "isCorrect": true/false,
  "confidence": "alta/media/baja",
  "explanation": "Explicación breve de tu análisis",
  "articleQuote": "Cita literal del artículo que justifica la respuesta",
  "suggestedFix": "Si hay error, sugiere la corrección. Si está bien, null",
  "correctOptionShouldBe": "A/B/C/D o null si está bien"
}`
}

// ============================================
// AI PROVIDER CALLS
// ============================================

interface AIResponse {
  response: Record<string, unknown>
  usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number }
}

function cleanJsonString(jsonStr: string): string {
  return jsonStr.replace(/"([^"\\]|\\.)*"/g, (match) => {
    return match
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/[\x00-\x1F\x7F]/g, '')
  })
}

function parseAIJsonResponse(content: string): Record<string, unknown> | null {
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    try {
      return JSON.parse(cleanJsonString(jsonMatch[0]))
    } catch {
      return null
    }
  }
}

export async function verifyWithOpenAI(
  prompt: string,
  apiKey: string,
  model = 'gpt-4o-mini'
): Promise<AIResponse> {
  if (!apiKey) {
    return { response: { error: 'OpenAI API key no configurada' }, usage: {} }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Eres un experto en derecho administrativo español. Respondes siempre en JSON válido.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: getMaxOutputTokens(model),
      }),
    })

    const data = await response.json()

    if (data.error) {
      return { response: { error: data.error.message }, usage: {} }
    }

    const content = data.choices?.[0]?.message?.content
    const usage = data.usage || {}

    if (!content) {
      console.error('OpenAI no devolvió contenido. Respuesta:', JSON.stringify(data))
      return { response: { error: 'OpenAI no devolvió contenido en la respuesta', raw: JSON.stringify(data) }, usage }
    }

    const parsed = parseAIJsonResponse(content)
    if (parsed) {
      return { response: parsed, usage }
    }

    console.error('No se encontró JSON en la respuesta de OpenAI:', content.substring(0, 500))
    return { response: { error: 'No se encontró JSON en la respuesta', raw: content.substring(0, 500) }, usage }
  } catch (error) {
    return { response: { error: (error as Error).message }, usage: {} }
  }
}

export async function verifyWithClaude(
  prompt: string,
  apiKey: string,
  model = 'claude-3-haiku-20240307'
): Promise<AIResponse> {
  if (!apiKey) {
    return { response: { error: 'Anthropic API key no configurada' }, usage: {} }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: getMaxOutputTokens(model),
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Error HTTP de Claude:', response.status, JSON.stringify(data))
      return { response: { error: data.error?.message || `Error HTTP ${response.status}`, raw: JSON.stringify(data) }, usage: {} }
    }

    if (data.error || data.type === 'error') {
      console.error('Error en respuesta de Claude:', JSON.stringify(data))
      return { response: { error: data.error?.message || data.message || 'Error desconocido de Claude', raw: JSON.stringify(data) }, usage: {} }
    }

    const content = data.content?.[0]?.text
    const usage = {
      input_tokens: data.usage?.input_tokens,
      output_tokens: data.usage?.output_tokens,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    }

    if (!content) {
      console.error('Claude no devolvió contenido. Respuesta:', JSON.stringify(data))
      return { response: { error: 'Claude no devolvió contenido en la respuesta', raw: JSON.stringify(data) }, usage }
    }

    const parsed = parseAIJsonResponse(content)
    if (parsed) {
      return { response: parsed, usage }
    }

    console.error('No se encontró JSON en la respuesta de Claude:', content.substring(0, 500))
    return { response: { error: 'No se encontró JSON en la respuesta', raw: content.substring(0, 500) }, usage }
  } catch (error) {
    return { response: { error: (error as Error).message }, usage: {} }
  }
}

export async function verifyWithGoogle(
  prompt: string,
  apiKey: string,
  model = 'gemini-1.5-flash'
): Promise<AIResponse> {
  if (!apiKey) {
    return { response: { error: 'Google AI API key no configurada' }, usage: {} }
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: `Eres un experto en derecho administrativo español. Respondes siempre en JSON válido.\n\n${prompt}` }] },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: getMaxOutputTokens(model),
          },
        }),
      }
    )

    const data = await response.json()

    if (data.error) {
      return { response: { error: data.error.message }, usage: {} }
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text
    const usage = {
      input_tokens: data.usageMetadata?.promptTokenCount || 0,
      output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0,
    }

    if (!content) {
      console.error('Google no devolvió contenido. Respuesta:', JSON.stringify(data))
      return { response: { error: 'Google no devolvió contenido en la respuesta', raw: JSON.stringify(data) }, usage }
    }

    const parsed = parseAIJsonResponse(content)
    if (parsed) {
      return { response: parsed, usage }
    }

    console.error('No se encontró JSON en la respuesta de Google:', content.substring(0, 500))
    return { response: { error: 'No se encontró JSON en la respuesta', raw: content.substring(0, 500) }, usage }
  } catch (error) {
    return { response: { error: (error as Error).message }, usage: {} }
  }
}

// ============================================
// BOE FETCHER (simplified, for single article)
// ============================================

export async function fetchArticleFromBOE(boeUrl: string, articleNumber: string): Promise<string | null> {
  try {
    const response = await fetch(boeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    })

    if (!response.ok) return null

    const html = await response.text()

    const articleRegex = new RegExp(
      `<div[^>]*id="a${articleNumber}"[^>]*>[\\s\\S]*?<h5[^>]*class="articulo"[^>]*>([\\s\\S]*?)</h5>([\\s\\S]*?)(?=<div[^>]*class="bloque"|$)`,
      'i'
    )

    const match = html.match(articleRegex)

    if (match) {
      const content = match[2]
        .replace(/<p[^>]*class="bloque"[^>]*>.*?<\/p>/gi, '')
        .replace(/<p[^>]*class="nota_pie"[^>]*>[\s\S]*?<\/p>/gi, '')
        .replace(/<p[^>]*class="pie_unico"[^>]*>[\s\S]*?<\/p>/gi, '')
        .replace(/<p[^>]*class="linkSubir"[^>]*>[\s\S]*?<\/p>/gi, '')
        .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
        .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '')
        .replace(/<a[^>]*class="[^"]*jurisprudencia[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
        .replace(/Jurisprudencia/gi, '')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/^ +| +$/gm, '')
        .trim()

      return content
    }

    return null
  } catch (error) {
    console.error('Error fetching BOE article:', error)
    return null
  }
}

// ============================================
// STATS HELPER
// ============================================

export function calculateIsOk(summary: Record<string, unknown> | null): boolean {
  if (!summary) return false
  if (summary.no_consolidated_text) return true

  const boeCount = (summary.boe_count ?? summary.total_boe ?? null) as number | null
  if (boeCount === 0) return false

  if (summary.message && typeof summary.message === 'string' && summary.message.includes('No se encontraron artículos')) return false

  const structureArticles = (summary.structure_articles as number) || 0
  const realExtraInDb = Math.max(0, ((summary.extra_in_db as number) || 0) - structureArticles)

  return (
    ((summary.title_mismatch as number) || 0) === 0 &&
    ((summary.content_mismatch as number) || 0) === 0 &&
    realExtraInDb === 0 &&
    ((summary.missing_in_db as number) || 0) === 0
  )
}
