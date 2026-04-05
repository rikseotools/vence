// lib/api/oep-signals/llm-extractor.ts
// Sensor 1: LLM semántico sobre páginas oficiales de seguimiento
// Extrae entidades OEP estructuradas del HTML de la página oficial.
import { getAnthropic } from '@/lib/chat/shared/anthropic'
import { llmExtractionSchema, safeParseLlmExtraction, type LlmExtraction } from './schemas'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

/**
 * Limpia HTML a texto plano + conserva estructura mínima relevante.
 * Elimina scripts, estilos, tags HTML pero mantiene texto, fechas, números.
 * Límite de tamaño para control de tokens.
 */
function cleanHtml(html: string, maxChars = 20000): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

  if (text.length > maxChars) {
    text = text.slice(0, maxChars) + ' ...[truncado]'
  }
  return text
}

const EXTRACTION_SYSTEM_PROMPT = `Eres un extractor de datos estructurados. Analizas páginas oficiales de convocatorias de oposiciones españolas (Gobierno de Canarias, Comunidad de Madrid, etc.) y extraes información de OEPs/convocatorias.

IMPORTANTE:
- Si la página no contiene información clara de una OEP activa → hasOepInfo=false
- Si detectas MÚLTIPLES OEPs, extrae SOLO la MÁS RECIENTE (año mayor)
- Fechas en formato ISO (YYYY-MM-DD). Si solo hay mes/año aproximados, null
- Plazas: números enteros. Si no se menciona, null
- bocRef: formato exacto "BOC-A-2026-057-948" o equivalente para otros boletines
- estado: infiere en qué fase está el proceso
- summary: UNA frase en español explicando qué detectaste

Responde EXCLUSIVAMENTE con un objeto JSON válido (sin markdown, sin explicaciones).`

const EXTRACTION_USER_PROMPT = (text: string, knownContext: string) => `Contexto de lo que YA tenemos en BD sobre esta oposición:
${knownContext}

Contenido de la página oficial a analizar:
<pagina>
${text}
</pagina>

Extrae la OEP/convocatoria más reciente. Devuelve JSON con esta forma exacta:
{
  "hasOepInfo": boolean,
  "year": number | null,
  "plazasLibre": number | null,
  "plazasDiscapacidad": number | null,
  "plazasPromocionInterna": number | null,
  "bocRef": string | null,
  "fechaPublicacion": string | null,
  "fechaInscripcionFin": string | null,
  "fechaExamen": string | null,
  "estado": "oep_aprobada" | "convocada" | "inscripcion_abierta" | "inscripcion_cerrada" | "lista_admitidos" | "pendiente_examen" | "examen_realizado" | "resultados" | null,
  "summary": string
}`

/**
 * Envía HTML a Claude Haiku y extrae entidades estructuradas.
 */
export async function extractOepFromHtml(
  html: string,
  knownContext: string
): Promise<LlmExtraction | null> {
  const cleanText = cleanHtml(html)
  if (cleanText.length < 200) {
    return null
  }

  const client = await getAnthropic()

  try {
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: EXTRACTION_USER_PROMPT(cleanText, knownContext) },
      ],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    // Parsear JSON (aceptar fences accidentales)
    let raw = textBlock.text.trim()
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')

    const parsed = JSON.parse(raw)
    const validation = safeParseLlmExtraction(parsed)
    if (!validation.success) {
      console.warn('⚠️ [LlmExtractor] Response no valida schema:', validation.error.issues)
      return null
    }
    return validation.data
  } catch (err) {
    console.error('❌ [LlmExtractor] Error:', err)
    return null
  }
}

/**
 * Fetch URL con timeout y User-Agent.
 */
export async function fetchPageHtml(url: string, timeoutMs = 15000): Promise<{ html: string | null; status: number; error?: string }> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'VenceBot/1.0 (+https://www.vence.es/oep-detection)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    clearTimeout(timeoutId)
    if (!res.ok) {
      return { html: null, status: res.status, error: `HTTP ${res.status}` }
    }
    const html = await res.text()
    return { html, status: res.status }
  } catch (err) {
    clearTimeout(timeoutId)
    const msg = err instanceof Error ? err.message : String(err)
    return { html: null, status: 0, error: msg }
  }
}
