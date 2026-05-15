// lib/chat/domains/app-help/AppHelpDomain.ts
// Dominio para preguntas sobre funcionalidades de la app Vence
// ("cómo veo mis fallos", "dónde está el ranking", "puedo imprimir", etc.).
//
// Sin este dominio, estas preguntas caían en fallback con búsqueda híbrida
// que devolvía artículos legales irrelevantes, y el LLM improvisaba
// instrucciones genéricas tipo "Inicia sesión, dirígete a Tests..." sin
// dar el link concreto. Detectado en auditoría de chats libres 15/05.

import type { ChatDomain, ChatContext, ChatResponse, AITracerInterface } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { logger } from '../../shared/logger'
import { findBestFeatureMatch, resolveRoute, type AppFeature } from './catalog'

/**
 * "Fast-track keywords" — términos que en mensajes cortos casi siempre
 * indican que el usuario pregunta sobre la app (no sobre legislación).
 * Si la palabra aparece y el mensaje es ≤10 palabras, capturamos aunque
 * no matchee ningún patrón explícito. Cubre casos como solo "ranking"
 * o "preguntas que he fallado".
 *
 * Estos términos son muy específicos del contexto app: no aparecen
 * habitualmente en preguntas legales/temario.
 */
const FAST_TRACK_KEYWORDS = [
  'ranking',
  'simulacro',
  // Variantes "preguntas falladas" (stems explícitos)
  'fallado', 'fallada', 'falladas', 'fallados',
  'fallido', 'fallida', 'fallidas', 'fallidos',
]

function matchesFastTrack(message: string): boolean {
  const wordCount = message.split(/\s+/).filter(w => w.length > 1).length
  if (wordCount > 10) return false
  return FAST_TRACK_KEYWORDS.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(message))
}

/**
 * Patrones que indican que el usuario pregunta sobre cómo USAR la app
 * (no sobre temario legal). Combinados con el catálogo de features dan
 * matching de alta precisión.
 */
const APP_HELP_PATTERNS = [
  // "cómo (puedo) X" / "cómo veo / cómo accedo / cómo hago"
  /c[oó]mo\s+(puedo\s+)?(ver|veo|consultar|consulto|revisar|reviso|repasar|repaso|acceder|accedo|hacer|hago|usar|uso|cambiar|cambio|editar|edito|borrar|filtrar|descargar|descargo|exportar|exporto|imprimir|imprimo|cancelar|cancelo)/i,
  /d[oó]nde\s+(est[aá]|encuentro|puedo|veo|aparece|se\s+ve|tengo)/i,
  /puedo\s+(ver|imprimir|descargar|exportar|cambiar|cancelar|filtrar|repetir|reintentar|configurar|elegir|seleccionar)/i,
  // "puedes (X) + verbo informativo" — petición a la IA sobre la app
  /puedes\s+(copiar|listar|mostrar|enviar|d[ae]rme|pasarme|ense[ñn]arme|indicarme|decirme)/i,
  // "qué es X" / "qué hace X"
  /qu[eé]\s+(es|hace|incluye|tiene)\s+(el|la|los|las)\s+(ranking|estad[ií]stica|temario|progreso|simulacro|premium|plan|repaso|chat|test|oficial)/i,
  /qu[eé]\s+es\s+vence/i,
  /c[oó]mo\s+funciona\s+(el|la|los|las|esto|esta)?\s*(test|temario|simulacro|premium|ranking|progreso|chat|sistema|app|plataforma)?/i,
  // "el X es real / fiable / preciso" — usuario duda de feature
  /(el|la|los|las)\s+(ranking|estad[ií]stica|progreso|simulacro)\s+(es|son)\s+(real|reales|fiable|fiables|preciso|precisos|de\s+verdad)/i,
  // "X es real?"
  /(ranking|estad[ií]sticas?|progreso|simulacros?|premium)\s+(es|son)\s+(real|reales|fiable|fiables)/i,
  /(es|son)\s+(real|reales|fiable|fiables)\s+(el|la|los|las)\s+(ranking|estad[ií]stica|progreso|simulacro)/i,
  // "hay (alguna) opción / forma / manera" + de/para/que
  /h?ay\s+(alguna\s+)?(opci[oó]n|forma|manera)\s+(de|para|que|en)/i,
  /existe\s+(alguna\s+|la\s+)?(opci[oó]n|forma|manera)/i,
  // "(me) gustaría saber si hay" — pregunta indirecta sobre feature
  /(me\s+)?gustar[ií]a\s+saber\s+si\s+(hay|existe|puedo)/i,
  // "saber por qué/dónde/cómo voy" — usuario quiere status
  /(saber|consultar|ver)\s+(por\s+)?(qu[eé]|d[oó]nde|c[oó]mo)\s+(voy|llevo|he|tema|art[ií]culo)/i,
  /(qu[eé]|por\s+d[oó]nde)\s+(tema|art[ií]culo|lecci[oó]n|bloque)\s+(voy|llevo|estoy)/i,
  /se\s+puede\s+(ver|hacer|cancelar|imprimir|descargar|cambiar|filtrar|reintentar|repetir|configurar)/i,
]

export class AppHelpDomain implements ChatDomain {
  name = 'app-help'
  // Prioridad alta: si claramente es pregunta de la app, capturamos antes
  // que search/verification (que buscarían en BD legal sin sentido).
  // Verification (1) y Psychometric (1.5) tienen prioridad si hay questionContext
  // psico — los regex de aquí solo matchean preguntas explícitas sobre la app.
  priority = 1.7

  async canHandle(context: ChatContext): Promise<boolean> {
    const msg = context.currentMessage
    if (!msg || msg.length < 3) return false

    // Solo aplicar a chat libre sin questionContext activo. Si el usuario
    // está dentro de una pregunta del test, los dominios Verification/
    // Psychometric/Search deben manejarlo.
    if (context.questionContext?.questionId) return false

    // Primera condición: o matchea patrón explícito, o es "fast-track"
    // (keyword muy específica en mensaje corto).
    const matchesPattern = APP_HELP_PATTERNS.some(p => p.test(msg))
    const fastTrack = matchesFastTrack(msg)
    if (!matchesPattern && !fastTrack) return false

    // Segunda condición: alguna feature del catálogo tiene keywords que
    // aparecen en el mensaje. Sin keyword no podemos dar link útil.
    const feature = findBestFeatureMatch(msg)
    if (!feature) return false

    logger.debug(`AppHelpDomain will handle: feature=${feature.id}`, { domain: 'app-help' })
    return true
  }

  async handle(context: ChatContext, _tracer?: AITracerInterface): Promise<ChatResponse> {
    const startTime = Date.now()
    const feature = findBestFeatureMatch(context.currentMessage)

    if (!feature) {
      // Salvaguarda: canHandle ya garantiza esto, pero por si acaso.
      return new ChatResponseBuilder()
        .domain('app-help')
        .text('No he encontrado información concreta sobre eso en la plataforma. ¿Puedes describir con más detalle qué quieres hacer?')
        .processingTime(Date.now() - startTime)
        .build()
    }

    const route = resolveRoute(feature, context.userDomain)
    const responseText = buildFeatureResponse(feature, route)

    logger.info(`AppHelpDomain: matched feature ${feature.id}, route=${route}`, {
      domain: 'app-help',
    })

    return new ChatResponseBuilder()
      .domain('app-help')
      .text(responseText)
      .processingTime(Date.now() - startTime)
      .build()
  }
}

/**
 * Construye el texto de respuesta para una feature. Estructura:
 *   **Title** 📚
 *   Description.
 *   👉 [Title](route)
 */
function buildFeatureResponse(feature: AppFeature, route: string): string {
  return `**${feature.title}**\n\n${feature.description}\n\n👉 [Ir a ${feature.title}](${route})`
}

// Singleton
let appHelpDomainInstance: AppHelpDomain | null = null

export function getAppHelpDomain(): AppHelpDomain {
  if (!appHelpDomainInstance) {
    appHelpDomainInstance = new AppHelpDomain()
  }
  return appHelpDomainInstance
}
