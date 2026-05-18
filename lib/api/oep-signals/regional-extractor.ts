// lib/api/oep-signals/regional-extractor.ts
// Sensor regional_scan: LLM extrae TODAS las convocatorias C1/C2 de una página de listado.
import { getAnthropic } from '@/lib/chat/shared/anthropic'
import { z } from 'zod/v3'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export const regionalOepSchema = z.object({
  name: z.string().describe('Nombre de la convocatoria/proceso selectivo tal como aparece'),
  positionGroup: z.string().nullable().describe('C1, C2, A1, A2 si se menciona; null si no'),
  year: z.number().int().nullable(),
  plazas: z.number().int().nullable(),
  bocRef: z.string().nullable().describe('Referencia del boletín oficial si aparece'),
  fechaInscripcionFin: z.string().nullable().describe('ISO date YYYY-MM-DD'),
  estado: z.string().nullable().describe('fase del proceso: oep_aprobada | convocada | inscripcion_abierta | inscripcion_cerrada | lista_admitidos | pendiente_examen | resultados'),
  url: z.string().nullable().describe('URL específica de la ficha de esta convocatoria si aparece'),
})
export type RegionalOep = z.infer<typeof regionalOepSchema>

export const regionalExtractionSchema = z.object({
  oeps: z.array(regionalOepSchema),
})
export type RegionalExtraction = z.infer<typeof regionalExtractionSchema>

function cleanHtml(html: string, maxChars = 25000): string {
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
  if (text.length > maxChars) text = text.slice(0, maxChars) + ' ...[truncado]'
  return text
}

const SYSTEM_PROMPT = `Eres un extractor de listados de convocatorias de empleo público en España. Analizas páginas oficiales con listas de procesos selectivos y extraes SOLO las convocatorias de subgrupos C1 o C2 (auxiliares administrativos, administrativos, subalternos, oficiales, técnicos administrativos, gestión tributaria, archivo, etc.).

CRITERIOS DE INCLUSIÓN:
- Grupo C1 o C2 (funcionarios)
- O que mencionen "auxiliar administrativo", "administrativo", "administrativa", "oficial administrativo" sin grupo
- Procesos ACTIVOS o RECIENTES (no convocatorias cerradas hace años)

CRITERIOS DE EXCLUSIÓN:
- Grupos A1, A2, B (escala superior, técnicos superiores)
- Personal laboral (si se identifica claramente)
- Procesos finalizados con nombramientos

Responde EXCLUSIVAMENTE con JSON válido sin markdown.`

const USER_PROMPT = (text: string, regionName: string) => `Página oficial de convocatorias de ${regionName}:

<pagina>
${text}
</pagina>

Extrae TODAS las convocatorias de C1/C2 activas. JSON esperado:
{
  "oeps": [
    {
      "name": "Auxiliar Administrativo 2025",
      "positionGroup": "C2",
      "year": 2025,
      "plazas": 278,
      "bocRef": "BOC-A-2026-057-948",
      "fechaInscripcionFin": "2026-04-23",
      "estado": "inscripcion_abierta",
      "url": "https://..."
    }
  ]
}

Si no hay ninguna convocatoria C1/C2, devuelve {"oeps": []}.`

export async function extractRegionalOeps(
  html: string,
  regionName: string
): Promise<RegionalExtraction | null> {
  const cleanText = cleanHtml(html)
  if (cleanText.length < 200) return null

  const client = await getAnthropic()
  try {
    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: USER_PROMPT(cleanText, regionName) }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    let raw = textBlock.text.trim()
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')

    // Extraer SOLO el primer objeto JSON. Haiku a veces incluye texto
    // explicativo antes o después del JSON (ej. "Aquí tienes el resultado:
    // {...}" o "{...} Espero que ayude"), lo que rompe JSON.parse(raw).
    // El regex {[\s\S]*} es greedy desde el primer `{` hasta el último `}`,
    // suficiente para JSON anidado de cualquier profundidad.
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.warn('⚠️ [RegionalExtractor] No se encontró JSON en la respuesta')
      return null
    }

    const parsed = JSON.parse(jsonMatch[0])
    const validation = regionalExtractionSchema.safeParse(parsed)
    if (!validation.success) {
      console.warn('⚠️ [RegionalExtractor] Validación fallida:', validation.error.issues)
      return null
    }
    return validation.data
  } catch (err) {
    console.error('❌ [RegionalExtractor] Error:', err)
    return null
  }
}
