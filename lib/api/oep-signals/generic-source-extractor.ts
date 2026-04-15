// lib/api/oep-signals/generic-source-extractor.ts
// Extractor LLM para fuentes estatales de Función Pública que publican
// instrucciones/circulares/acuerdos NO siempre reflejados en BOE.
//
// Estrategia: se invoca SOLO cuando el hash de la página cambia (filtra
// >95% del ruido cosmético). El LLM decide si el cambio es relevante al
// temario de oposiciones estatales o es ruido (noticias, fechas de
// actualización, banners, etc.).

import { getAnthropic } from '@/lib/chat/shared/anthropic'
import { z } from 'zod'
import { fetchPageHtml } from './llm-extractor'

export { fetchPageHtml }

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export const genericSourceExtractionSchema = z.object({
  hasRelevantChange: z.boolean(),
  items: z.array(z.object({
    title: z.string(),
    date: z.string().nullable(),   // ISO YYYY-MM-DD si se detecta
    type: z.enum(['instruccion', 'circular', 'acuerdo', 'resolucion', 'plan', 'nota', 'otro']),
    affectsTopic: z.string(),       // ej: "TREBEP jornada/permisos", "Ley 39/2015 procedimiento"
    relevance: z.enum(['alta', 'media', 'baja']),
    url: z.string().nullable(),
  })).max(10),
  summary: z.string(),
})
export type GenericSourceExtraction = z.infer<typeof genericSourceExtractionSchema>

function cleanHtml(html: string, maxChars = 30000): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length > maxChars) text = text.slice(0, maxChars) + ' ...[truncado]'
  return text
}

const SYSTEM_PROMPT = `Eres auditor de fuentes normativas del Estado (Dirección General de Función Pública, Secretaría de Estado de FP, Portal de Transparencia). Tu trabajo: leer el contenido actual de una página y determinar si contiene PUBLICACIONES NORMATIVAS NUEVAS que afecten al temario de oposiciones estatales (Aux/Admin Estado, Tramitación Procesal, Auxilio Judicial, Gestión Estado, Admin. Seguridad Social).

Qué ES relevante:
- Instrucciones de DGFP (teletrabajo, jornada, permisos, carrera profesional...)
- Circulares Subsecretaría Función Pública
- Acuerdos Mesa General Negociación Empleados Públicos
- Resoluciones interpretativas TREBEP / Ley 39/2015 / Ley 40/2015
- Planes estratégicos (Igualdad AGE, Antifraude, Protección de datos sector público)
- Pactos / resoluciones sobre retribuciones del sector público

Qué NO es relevante (ignorar):
- Noticias, notas de prensa sobre eventos
- Ofertas de empleo concretas (ya se monitorizan por sus propias páginas)
- Fechas de "última actualización" de la web sin contenido normativo nuevo
- Banners, pop-ups, tooltips de navegación
- Menús, pie de página, cookies
- Contenido antiguo (>1 año) que lleva ahí siempre

Si no detectas NADA claramente normativo y reciente → hasRelevantChange=false.

Responde EXCLUSIVAMENTE con un objeto JSON válido (sin markdown, sin explicaciones adicionales).`

const userPrompt = (sourceName: string, lastCheckedAt: string | null, text: string) => `Fuente analizada: ${sourceName}
Última revisión previa: ${lastCheckedAt || 'primera vez'}

Contenido actual de la página:
<pagina>
${text}
</pagina>

Devuelve JSON con esta forma exacta:
{
  "hasRelevantChange": boolean,
  "items": [
    {
      "title": "...",
      "date": "YYYY-MM-DD" | null,
      "type": "instruccion" | "circular" | "acuerdo" | "resolucion" | "plan" | "nota" | "otro",
      "affectsTopic": "descripción breve del tema afectado",
      "relevance": "alta" | "media" | "baja",
      "url": "https://..." | null
    }
  ],
  "summary": "Frase corta en español resumiendo lo detectado."
}

Si nada relevante → hasRelevantChange=false y items=[].`

export async function extractGenericSourceChanges(
  sourceName: string,
  html: string,
  lastCheckedAt: string | null
): Promise<GenericSourceExtraction | null> {
  const text = cleanHtml(html)
  if (text.length < 200) return null

  try {
    const anthropic = await getAnthropic()
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt(sourceName, lastCheckedAt, text) }],
    })

    const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = genericSourceExtractionSchema.safeParse(JSON.parse(jsonMatch[0]))
    if (!parsed.success) {
      console.warn('[generic-source] Validación JSON falló:', parsed.error.issues.slice(0, 2))
      return null
    }
    return parsed.data
  } catch (err) {
    console.error('[generic-source] Error LLM:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Hash SHA-256 del contenido limpio (sin scripts/styles/comments).
 * Usa texto limpio en vez de HTML raw para resistir cambios cosméticos
 * que no afectan al contenido visible.
 */
export function computeContentHash(html: string): string {
  const crypto = require('crypto') as typeof import('crypto')
  const clean = cleanHtml(html, 100000)
  return crypto.createHash('sha256').update(clean).digest('hex')
}
