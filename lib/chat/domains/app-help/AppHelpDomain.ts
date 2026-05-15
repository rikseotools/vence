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
 * Patrones que indican que el usuario pregunta sobre cómo USAR la app
 * (no sobre temario legal). Combinados con el catálogo de features dan
 * matching de alta precisión.
 */
const APP_HELP_PATTERNS = [
  // "cómo (puedo) X" / "cómo veo / cómo accedo / cómo hago"
  /c[oó]mo\s+(puedo\s+)?(ver|veo|consultar|consulto|revisar|reviso|repasar|repaso|acceder|accedo|hacer|hago|usar|uso|cambiar|cambio|editar|edito|borrar|filtrar|descargar|descargo|exportar|exporto|imprimir|imprimo|cancelar|cancelo)/i,
  /d[oó]nde\s+(est[aá]|encuentro|puedo|veo|aparece|se\s+ve|tengo)/i,
  /puedo\s+(ver|imprimir|descargar|exportar|cambiar|cancelar|filtrar|repetir|reintentar|configurar|elegir|seleccionar)/i,
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

    // Primera condición: el mensaje matchea uno de los patrones explícitos
    // de "pregunta sobre app". Si no matchea, no es nuestro territorio.
    const matchesPattern = APP_HELP_PATTERNS.some(p => p.test(msg))
    if (!matchesPattern) return false

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
