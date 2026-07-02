import { Injectable, Logger } from '@nestjs/common';
import { AnthropicService } from '../anthropic/anthropic.service';
import {
  genericSourceExtractionSchema,
  llmExtractionSchema,
  regionalExtractionSchema,
  type GenericSourceExtraction,
  type LlmExtraction,
  type RegionalExtraction,
} from './oep-signals.schemas';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Servicio LLM para los tres sensores OEP que usan Claude Haiku.
 * Portado de `lib/api/oep-signals/llm-extractor.ts`,
 * `regional-extractor.ts` y `generic-source-extractor.ts`.
 */
@Injectable()
export class OepSignalsLlmService {
  private readonly logger = new Logger(OepSignalsLlmService.name);

  constructor(private readonly anthropic: AnthropicService) {}

  // ============================================
  // FETCH HTML
  // ============================================

  /**
   * Fetcha la página vía HTTP nativo o vía Lambda headless según `fetcherType`.
   *
   * - `'http'` (default): fetch nativo Node. Rápido (~200-500ms) pero solo ve
   *   el HTML inicial. No ejecuta JS.
   * - `'headless'`: invoca Lambda `vence-backend-headless-fetcher` con Playwright
   *   + Chromium. Renderiza JS, espera networkidle, devuelve HTML post-hydration.
   *   Latencia ~3-10s. Sprint 1 + 2 del roadmap deteccion-convocatorias-oeps-completo.md.
   *
   * El `fetcher_type` viene de `oposiciones.fetcher_type` (Sprint A del roadmap
   * oposiciones-coverage-level). El audit Fase 0 marcó las JS-rendered.
   */
  async fetchPageHtml(
    url: string,
    timeoutMs = 15000,
    fetcherType: 'http' | 'headless' = 'http',
  ): Promise<{ html: string | null; status: number; error?: string }> {
    if (fetcherType === 'headless') {
      return this.fetchViaLambda(url, timeoutMs);
    }
    return this.fetchViaHttp(url, timeoutMs);
  }

  private async fetchViaHttp(
    url: string,
    timeoutMs: number,
  ): Promise<{ html: string | null; status: number; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'VenceBot/1.0 (+https://www.vence.es/oep-detection)',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        return { html: null, status: res.status, error: `HTTP ${res.status}` };
      }
      const html = await res.text();
      return { html, status: res.status };
    } catch (err) {
      clearTimeout(timeoutId);
      const msg = err instanceof Error ? err.message : String(err);
      return { html: null, status: 0, error: msg };
    }
  }

  private async fetchViaLambda(
    url: string,
    timeoutMs: number,
  ): Promise<{ html: string | null; status: number; error?: string }> {
    // Lazy import del SDK AWS para no penalizar arranque cuando no se usa.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
    const region = process.env.AWS_REGION ?? 'eu-west-2';
    const functionName =
      process.env.HEADLESS_FETCHER_FUNCTION_NAME ?? 'vence-backend-headless-fetcher';
    const client = new LambdaClient({ region });

    try {
      const payload = {
        url,
        timeout_ms: Math.min(timeoutMs, 50_000),
      };
      const cmd = new InvokeCommand({
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: Buffer.from(JSON.stringify(payload)),
      });
      const resp = await client.send(cmd);
      if (!resp.Payload) {
        return { html: null, status: 0, error: 'Lambda devolvió payload vacío' };
      }
      const decoded = Buffer.from(resp.Payload).toString('utf-8');
      const parsed = JSON.parse(decoded) as {
        ok: boolean;
        status: number;
        html: string | null;
        error?: string;
      };
      if (!parsed.ok || parsed.html === null) {
        return {
          html: parsed.html ?? null,
          status: parsed.status ?? 0,
          error: parsed.error ?? 'Lambda devolvió ok=false',
        };
      }
      return { html: parsed.html, status: parsed.status };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Lambda fetcher falló (${url}): ${msg}`);
      return { html: null, status: 0, error: msg };
    }
  }

  // ============================================
  // LLM SEMANTIC — Sensor 1 (detect-oep-llm)
  // ============================================

  async extractOepFromHtml(
    html: string,
    knownContext: string,
  ): Promise<LlmExtraction | null> {
    const cleanText = this.cleanHtml(html, 20000);
    if (cleanText.length < 200) return null;

    const client = await this.anthropic.getClient();
    try {
      const response = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 1024,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: extractionUserPrompt(cleanText, knownContext),
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') return null;

      let raw = textBlock.text.trim();
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

      const parsed = JSON.parse(raw) as unknown;
      const validation = llmExtractionSchema.safeParse(parsed);
      if (!validation.success) {
        this.logger.warn(
          `LlmExtractor respuesta inválida: ${JSON.stringify(validation.error.issues)}`,
        );
        return null;
      }
      return validation.data;
    } catch (err) {
      this.logger.error(
        `LlmExtractor error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  // ============================================
  // REGIONAL SCAN — Sensor 2 (detect-regional-oeps)
  // ============================================

  async extractRegionalOeps(
    html: string,
    regionName: string,
  ): Promise<RegionalExtraction | null> {
    const cleanText = this.cleanHtml(html, 25000);
    if (cleanText.length < 200) return null;

    const client = await this.anthropic.getClient();
    try {
      const response = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 3000,
        system: REGIONAL_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: regionalUserPrompt(cleanText, regionName),
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') return null;

      let raw = textBlock.text.trim();
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.logger.warn('RegionalExtractor: no se encontró JSON en respuesta');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]) as unknown;
      const validation = regionalExtractionSchema.safeParse(parsed);
      if (!validation.success) {
        this.logger.warn(
          `RegionalExtractor validación fallida: ${JSON.stringify(validation.error.issues)}`,
        );
        return null;
      }
      return validation.data;
    } catch (err) {
      this.logger.error(
        `RegionalExtractor error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  // ============================================
  // GENERIC SOURCE — Sensor 4 (detect-generic-sources)
  // ============================================

  async extractGenericSourceChanges(
    sourceName: string,
    html: string,
    lastCheckedAt: string | null,
  ): Promise<GenericSourceExtraction | null> {
    const text = this.cleanHtml(html, 30000);
    if (text.length < 200) return null;

    const client = await this.anthropic.getClient();
    try {
      const response = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 2000,
        system: GENERIC_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: genericUserPrompt(sourceName, lastCheckedAt, text),
          },
        ],
      });

      const raw =
        response.content[0]?.type === 'text' ? response.content[0].text : '';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = genericSourceExtractionSchema.safeParse(
        JSON.parse(jsonMatch[0]),
      );
      if (!parsed.success) {
        this.logger.warn(
          `GenericSource validación JSON falló: ${JSON.stringify(parsed.error.issues.slice(0, 2))}`,
        );
        return null;
      }
      return parsed.data;
    } catch (err) {
      this.logger.error(
        `GenericSource LLM error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  // ============================================
  // CONTENT HASH (para detect-generic-sources)
  // ============================================

  computeContentHash(html: string): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto') as typeof import('crypto');
    const clean = this.cleanHtml(html, 100000);
    return crypto.createHash('sha256').update(clean).digest('hex');
  }

  // ============================================
  // HELPERS PRIVADOS
  // ============================================

  private cleanHtml(html: string, maxChars: number): string {
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
      .trim();

    if (text.length > maxChars) {
      text = text.slice(0, maxChars) + ' ...[truncado]';
    }
    return text;
  }
}

// ============================================
// PROMPTS (portados verbatim de los extractores originales)
// ============================================

const EXTRACTION_SYSTEM_PROMPT = `Eres un extractor de datos estructurados. Analizas páginas oficiales de convocatorias de oposiciones españolas (Gobierno de Canarias, Comunidad de Madrid, etc.) y extraes información de OEPs/convocatorias.

IMPORTANTE:
- La oposición de Vence es de un CUERPO/PUESTO concreto (ver "Nombre" en el contexto BD).
  Extrae ÚNICAMENTE la convocatoria de ESE MISMO cuerpo/puesto.
- Las páginas oficiales suelen listar MUCHOS cuerpos a la vez (peón, psicólogo, bombero,
  policía local, administrativo, auxiliar, ordenanza, conductor…). NO cojas otro cuerpo
  solo por ser el más reciente: si no es el cuerpo de la oposición, ignóralo.
- Si en la página NO hay ninguna convocatoria del cuerpo de la oposición → hasOepInfo=false
  (aunque haya otras OEPs de otros cuerpos)
- cuerpoDetectado: nombre textual del cuerpo/puesto de la convocatoria que extraes (para verificación)
- Fechas en formato ISO (YYYY-MM-DD). Si solo hay mes/año aproximados, null
- Plazas: números enteros. Si no se menciona, null
- bocRef: formato exacto "BOC-A-2026-057-948" o equivalente para otros boletines
- estado: infiere en qué fase está el proceso
- summary: UNA frase en español explicando qué detectaste

Responde EXCLUSIVAMENTE con un objeto JSON válido (sin markdown, sin explicaciones).`;

function extractionUserPrompt(text: string, knownContext: string): string {
  return `Contexto de lo que YA tenemos en BD sobre esta oposición:
${knownContext}

Contenido de la página oficial a analizar:
<pagina>
${text}
</pagina>

Extrae la convocatoria del MISMO cuerpo/puesto que la oposición del contexto BD
(campo "Nombre"). Si ese cuerpo no aparece en la página, hasOepInfo=false.
Devuelve JSON con esta forma exacta:
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
  "cuerpoDetectado": string | null,
  "summary": string
}`;
}

const REGIONAL_SYSTEM_PROMPT = `Eres un extractor de listados de convocatorias de empleo público en España. Analizas páginas oficiales con listas de procesos selectivos y extraes SOLO las convocatorias de subgrupos C1, C2 o Agrupaciones Profesionales (auxiliares administrativos, administrativos, subalternos, ordenanzas, personal de servicios, agrupación profesional, oficiales, técnicos administrativos, gestión tributaria, archivo, etc.).

CRITERIOS DE INCLUSIÓN:
- Grupo C1 o C2 (funcionarios)
- Agrupaciones Profesionales (AP), antiguo Grupo E: sin requisito de titulación (subalternos, ordenanzas, personal de servicios, "agrupación profesional de servicios públicos") → devuelve positionGroup "AP"
- O que mencionen "auxiliar administrativo", "administrativo", "administrativa", "oficial administrativo" sin grupo
- Procesos ACTIVOS o RECIENTES (no convocatorias cerradas hace años)

CRITERIOS DE EXCLUSIÓN:
- Grupos A1, A2, B (escala superior, técnicos superiores)
- Personal laboral (si se identifica claramente)
- Procesos finalizados con nombramientos

Responde EXCLUSIVAMENTE con JSON válido sin markdown.`;

function regionalUserPrompt(text: string, regionName: string): string {
  return `Página oficial de convocatorias de ${regionName}:

<pagina>
${text}
</pagina>

Extrae TODAS las convocatorias de C1/C2 y Agrupaciones Profesionales (AP) activas. JSON esperado:
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

Si no hay ninguna convocatoria C1/C2/AP, devuelve {"oeps": []}.`;
}

const GENERIC_SYSTEM_PROMPT = `Eres auditor de fuentes normativas del Estado (Dirección General de Función Pública, Secretaría de Estado de FP, Portal de Transparencia). Tu trabajo: leer el contenido actual de una página y determinar si contiene PUBLICACIONES NORMATIVAS NUEVAS que afecten al temario de oposiciones estatales (Aux/Admin Estado, Tramitación Procesal, Auxilio Judicial, Gestión Estado, Admin. Seguridad Social).

Qué ES relevante:
- Aprobación de OEP anual GENERAL (Real Decreto OEP, ej. RD 387/2026 OEP 2026)
- Resoluciones / instrucciones de JORNADA, horarios, teletrabajo, permisos del personal AGE
  (incluye reducciones de jornada: 35h, 37,5h, etc. — ej. BOE-A-2026-8287)
- Instrucciones de DGFP (carrera profesional, evaluación del desempeño...)
- Circulares Subsecretaría Función Pública
- Acuerdos Mesa General Negociación Empleados Públicos
- Resoluciones interpretativas TREBEP / Ley 39/2015 / Ley 40/2015
- Planes estratégicos (Igualdad AGE, Antifraude, Protección de datos sector público)
- Pactos / resoluciones sobre retribuciones del sector público

Qué NO es relevante (ignorar):
- Noticias y notas de prensa sobre eventos genéricos (cooperación internacional, premios,
  jornadas técnicas, inauguraciones, visitas)
- CONVOCATORIAS individuales de un cuerpo concreto con BOE-A propio
  (ej. "Cuerpo Auxiliar AGE convocatoria 2025" — ya se monitorizan por su URL específica)
- Fechas de "última actualización" de la web sin contenido normativo nuevo
- Banners, pop-ups, tooltips de navegación
- Menús, pie de página, cookies
- Contenido antiguo (>1 año) que lleva ahí siempre

Si no detectas NADA claramente normativo y reciente → hasRelevantChange=false.

Responde EXCLUSIVAMENTE con un objeto JSON válido (sin markdown, sin explicaciones adicionales).`;

function genericUserPrompt(
  sourceName: string,
  lastCheckedAt: string | null,
  text: string,
): string {
  return `Fuente analizada: ${sourceName}
Última revisión previa: ${lastCheckedAt ?? 'primera vez'}

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

Si nada relevante → hasRelevantChange=false y items=[].`;
}
