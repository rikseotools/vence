// lib/chat/domains/knowledge-base/KnowledgeBaseService.ts
// Servicio principal de la base de conocimiento

import { generateEmbedding } from '../search/EmbeddingService'
import {
  searchKnowledgeBase,
  searchKnowledgeBaseByKeywords,
  detectCategory,
  isPlatformQuery,
  extractPlatformKeywords,
  type KnowledgeBaseEntry,
  type KBCategory,
} from './queries'
import { logger } from '../../shared/logger'
import type { ChatContext } from '../../core/types'

// ============================================
// TIPOS
// ============================================

export interface KBSearchResult {
  entries: KnowledgeBaseEntry[]
  category: KBCategory | null
  searchMethod: 'semantic' | 'keywords' | 'none'
  confidence: number
}

// ============================================
// SERVICIO PRINCIPAL
// ============================================

/**
 * Busca información relevante en la knowledge base
 */
export async function searchKB(
  context: ChatContext
): Promise<KBSearchResult> {
  const message = context.currentMessage

  // 1. Detectar si es una consulta sobre la plataforma
  if (!isPlatformQuery(message)) {
    logger.debug('Not a platform query', { domain: 'knowledge-base' })
    return {
      entries: [],
      category: null,
      searchMethod: 'none',
      confidence: 0,
    }
  }

  // 2. Detectar categoría probable
  const category = detectCategory(message)
  logger.debug(`Detected category: ${category || 'none'}`, { domain: 'knowledge-base' })

  // 3. Intentar búsqueda semántica
  try {
    const { embedding } = await generateEmbedding(message)
    const entries = await searchKnowledgeBase(embedding, {
      threshold: 0.40,
      limit: 3,
      category,
    })

    if (entries.length > 0) {
      // Calcular confianza basada en similarity
      const avgSimilarity = entries.reduce((sum, e) => sum + (e.similarity || 0), 0) / entries.length
      const confidence = Math.min(avgSimilarity + 0.2, 1) // Boost por coincidencia de categoría

      logger.info(`KB semantic search: ${entries.length} results`, {
        domain: 'knowledge-base',
        category,
        avgSimilarity,
      })

      return {
        entries,
        category,
        searchMethod: 'semantic',
        confidence,
      }
    }
  } catch (error) {
    logger.error('Error in KB semantic search, falling back to keywords', error, {
      domain: 'knowledge-base',
    })
  }

  // 4. Fallback: búsqueda por keywords
  const keywords = extractPlatformKeywords(message)
  if (keywords.length > 0) {
    const entries = await searchKnowledgeBaseByKeywords(keywords, {
      limit: 3,
      category,
    })

    if (entries.length > 0) {
      logger.info(`KB keyword search: ${entries.length} results`, {
        domain: 'knowledge-base',
        keywords,
      })

      return {
        entries,
        category,
        searchMethod: 'keywords',
        confidence: 0.6, // Menor confianza para búsqueda por keywords
      }
    }
  }

  // 5. No se encontró nada
  logger.debug('No KB results found', { domain: 'knowledge-base' })
  return {
    entries: [],
    category,
    searchMethod: 'none',
    confidence: 0,
  }
}

/**
 * Formatea las entradas de KB para incluir en el prompt
 */
export function formatKBContext(entries: KnowledgeBaseEntry[]): string {
  if (!entries || entries.length === 0) {
    return ''
  }

  let context = '\n\n📋 INFORMACIÓN DE LA PLATAFORMA VENCE:\n'
  context += 'El usuario está preguntando sobre la plataforma. Usa esta información para responder:\n\n'

  entries.forEach((entry) => {
    context += `--- ${entry.title} ---\n`
    context += `${entry.content}\n\n`
  })

  context += 'IMPORTANTE: Responde de forma natural y amigable usando esta información. '
  context += 'No digas "según la base de conocimiento" ni cites la fuente, simplemente responde como si lo supieras.\n'

  return context
}

/**
 * Obtiene una respuesta corta si está disponible
 */
export function getShortAnswer(entries: KnowledgeBaseEntry[]): string | null {
  if (!entries || entries.length === 0) {
    return null
  }

  // Buscar la entrada con mayor prioridad que tenga shortAnswer
  const withShortAnswer = entries
    .filter(e => e.shortAnswer)
    .sort((a, b) => b.priority - a.priority)

  return withShortAnswer[0]?.shortAnswer || null
}

/**
 * Genera sugerencias de seguimiento basadas en la categoría
 */
export function generateKBSuggestions(category: KBCategory | null): string[] {
  const suggestions: Record<KBCategory, string[]> = {
    planes: [
      '¿Qué incluye el plan Premium?',
      '¿Cuánto cuesta la suscripción?',
      '¿Puedo probar gratis?',
    ],
    funcionalidades: [
      '¿Cómo creo un test personalizado?',
      '¿Dónde veo mis estadísticas?',
      '¿Qué son los psicotécnicos?',
    ],
    faq: [
      '¿Cómo contacto con soporte?',
      '¿Por qué no puedo acceder?',
      '¿Cómo cancelo mi suscripción?',
    ],
    plataforma: [
      '¿Qué oposiciones tenéis?',
      '¿Cuántas preguntas hay?',
      '¿De dónde salen las preguntas?',
    ],
    oposiciones: [
      '¿Qué leyes entran?',
      '¿Hay preguntas de exámenes oficiales?',
      '¿Se actualiza el temario?',
    ],
  }

  if (category && suggestions[category]) {
    return suggestions[category]
  }

  // Sugerencias generales
  return [
    '¿Qué planes hay disponibles?',
    '¿Cómo funciona Vence?',
    '¿Qué oposiciones preparáis?',
  ]
}

// ============================================
// RESPUESTAS PREDEFINIDAS
// ============================================

/**
 * Obtiene una respuesta predefinida para consultas comunes
 */
export function getPredefinedResponse(message: string): string | null {
  const msgLower = message.toLowerCase()

  // Psicotécnicos - pero NO cuando piden explicación de una pregunta específica
  // Si el usuario está pidiendo que expliquemos una pregunta, no devolver respuesta predefinida
  const isAskingForExplanation = /expl[ií]c(a|ame|ar)|resolver\s+(esta|la)\s+pregunta|c[oó]mo\s+se\s+resuelve|paso\s+a\s+paso|ayud(a|ame)\s+con\s+(esta|la)/i.test(msgLower)

  if (!isAskingForExplanation && /psicot[eé]c?n?i?c?o?s?|series\s+num[eé]ricas|series\s+alfab[eé]ticas|domin[oó]s|matrices|razonamiento\s+l[oó]gico/i.test(msgLower)) {
    return `📊 **¡Genial! Vamos a practicar psicotécnicos**

👉 **[Empezar a practicar psicotécnicos](/psicotecnicos/test)**

**Tipos de ejercicios disponibles:**
- 🔢 Series numéricas
- 🔤 Series alfabéticas
- 🧩 Secuencias lógicas
- 🎯 Analogías
- 🎲 Dominós
- 📊 Matrices

💡 Cuando estés resolviendo preguntas, ¡pídeme ayuda! Puedo explicarte la lógica de cada ejercicio.`
  }

  // Simulacros / modo examen
  if (/simulacro|modo\s+examen|examen\s+(completo|simulado|de\s+prueba|real)|practicar\s+(un\s+)?examen/i.test(msgLower)) {
    return `**Simulacros de examen en Vence**

En Vence puedes hacer simulacros que replican las condiciones reales del examen:

👉 **[Hacer simulacro de examen](/test/aleatorio-examen)**

**Modo Examen:**
- Todas las preguntas visibles a la vez (como en el examen real)
- Temporizador configurable
- Correccion solo al final (no ves si aciertas hasta acabar)
- Puedes elegir temas, cantidad de preguntas y dificultad

**Otros modos de practica:**
- **[Test aleatorio](/test/aleatorio)** - Preguntas una a una con correccion inmediata
- **[Test rapido](/test/rapido)** - 10 preguntas para repasar rapido
- **[Test por leyes](/test/por-leyes)** - Combina varias leyes en un solo test
- **[Repaso de fallos](/test/repaso-fallos)** - Repasa las preguntas que has fallado`
  }

  // Repaso de fallos
  if (/repas(o|ar)\s+(de\s+)?fallo/i.test(msgLower)) {
    return `**Repaso de fallos**

Puedes repasar las preguntas que has fallado anteriormente:

👉 **[Ir al repaso de fallos](/test/repaso-fallos)**

**Opciones:**
- Configura el periodo (ultimos 30 dias, fecha personalizada)
- Ordena por recientes, dificultad o frecuencia de fallo
- Se centra en tus puntos debiles para mejorar`
  }

  // Que hay / que puedo hacer / funcionalidades
  if (/\bqu[eé]\s+(puedo|se\s+puede)\s+hacer|\bqu[eé]\s+(hay|ofrece|tiene)|\bfuncionalidad|\bcaracter[ií]stica/i.test(msgLower)) {
    return `**Funcionalidades de Vence**

**Tests y practica:**
- **[Test aleatorio](/test/aleatorio)** - Configura temas, dificultad y cantidad
- **[Simulacro de examen](/test/aleatorio-examen)** - Modo examen real con temporizador
- **[Test rapido](/test/rapido)** - 10 preguntas rapidas
- **[Test por leyes](/test/por-leyes)** - Combina varias leyes
- **[Test por articulo](/test/articulo)** - Practica un articulo concreto
- **[Repaso de fallos](/test/repaso-fallos)** - Repasa lo que has fallado
- **[Psicotecnicos](/psicotecnicos/test)** - Series, analogias, razonamiento...

**Contenido:**
- **[Temario completo](/temarios)** - Programa oficial con todos los temas
- **[Leyes](/leyes)** - Textos legales con articulos navegables
- **[Convocatorias](/oposiciones)** - Convocatorias actualizadas del BOE

**Tu progreso:**
- **[Mis estadisticas](/mis-estadisticas)** - Rendimiento, rachas, areas debiles
- **[Mis impugnaciones](/mis-impugnaciones)** - Disputar preguntas incorrectas

**Este chat de IA** te ayuda a resolver dudas sobre legislacion, explicar preguntas y mas.`
  }

  // Impugnaciones / disputas
  if (/impugn|disput|reportar\s+(una\s+)?pregunta/i.test(msgLower)) {
    return `**Sistema de impugnaciones**

Si encuentras una pregunta con error, puedes impugnarla:

👉 **[Ver mis impugnaciones](/mis-impugnaciones)**

**Como funciona:**
- Al responder una pregunta, pulsa el boton de impugnar
- Describe el error que has encontrado
- Un administrador revisara tu impugnacion
- Puedes ver el estado (pendiente, resuelta, rechazada) en tu panel`
  }

  // Convocatorias
  if (/convocatoria|plazas?\s+(disponible|ofertada|publicada)/i.test(msgLower)) {
    return `**Convocatorias de oposiciones**

Consulta las convocatorias actualizadas del BOE:

👉 **[Ver convocatorias](/oposiciones)**

**Puedes filtrar por:**
- Categoria y tipo de puesto
- Comunidad autonoma y provincia
- Solo convocatorias con plazo abierto
- Departamento y ambito`
  }

  // Test de articulo
  if (/test\s+(de|por|solo)\s+(un\s+)?art[ií]culo|practicar\s+(un\s+)?art[ií]culo/i.test(msgLower)) {
    return `**Test por articulo**

Puedes practicar preguntas de un articulo concreto:

👉 **[Ir a test por articulo](/test/articulo)**

**Como funciona:**
- Elige una ley y un articulo especifico
- Se generan preguntas solo de ese articulo
- Ideal para repasar articulos que te cuestan

Tambien puedes ir a **[Leyes](/leyes)**, buscar el articulo y hacer test desde ahi.`
  }

  // Preguntas oficiales
  if (/pregunta.*oficial|ex[aá]me?n(es)?\s+oficial/i.test(msgLower)) {
    return `**Preguntas de examenes oficiales**

Si, en Vence hay preguntas de examenes oficiales reales de convocatorias anteriores.

**Como acceder:**
- En el **[Test aleatorio](/test/aleatorio)**, activa la opcion "Solo preguntas oficiales"
- Las preguntas oficiales se marcan con un badge especial al responderlas
- Los articulos mas preguntados en examenes se destacan como "articulos calientes"

Asi puedes practicar con las mismas preguntas que cayeron en examenes reales.`
  }

  // Donde veo mis estadisticas
  if (/d[oó]nde\s+(veo|est[aá]n?|encuentro)\s+(mis\s+)?estad[ií]stica/i.test(msgLower)) {
    return `**Tus estadisticas**

Puedes ver todo tu progreso aqui:

👉 **[Mis estadisticas](/mis-estadisticas)**

**Incluye:**
- Porcentaje de aciertos global y por tema
- Racha actual y mejor racha
- Progreso semanal
- Areas debiles
- Historial de tests`
  }

  // Cancelar suscripcion / darse de baja
  if (/cancel(ar|o|e)\s+(mi\s+)?(suscripci|plan|premium)|dar(me)?\s+de\s+baja/i.test(msgLower)) {
    return `**Cancelar suscripcion**

Puedes cancelar tu suscripcion en cualquier momento desde tu perfil:

👉 **[Ir a mi perfil](/perfil)**

**Pasos:**
1. Ve a tu perfil
2. En la seccion de suscripcion, pulsa "Gestionar suscripcion"
3. Confirma la cancelacion

Tu acceso premium se mantiene hasta el final del periodo pagado.`
  }

  // Racha / streak
  if (/\bracha\b/i.test(msgLower) && !/cancel|baja|precio|premium|plan/i.test(msgLower)) {
    return `**Sistema de rachas en Vence**

La racha es tu contador de dias consecutivos estudiando. Cada dia que respondes al menos una pregunta, tu racha sube.

**Como funciona:**
- Responde al menos 1 pregunta al dia para mantener la racha
- Si un dia no estudias, la racha se reinicia a 0
- En tu perfil ves tu **racha actual** y tu **mejor racha**

👉 **[Mantener racha con test rapido](/test/mantener-racha)**

Es una forma de mantenerte motivado y crear habito de estudio diario.`
  }

  // Tipos de test
  if (/\bqu[eé]\s+(tipo|clase|modo)s?\s+de\s+(test|examen|ejercicio|practica)/i.test(msgLower) || /\btipos?\s+de\s+test/i.test(msgLower)) {
    return `**Tipos de test en Vence**

- **[Test aleatorio](/test/aleatorio)** - Configura temas, dificultad y cantidad de preguntas
- **[Simulacro de examen](/test/aleatorio-examen)** - Modo examen real: todas las preguntas a la vez, temporizador, correccion al final
- **[Test rapido](/test/rapido)** - 10 preguntas para practicar rapido
- **[Test por leyes](/test/por-leyes)** - Combina varias leyes en un solo test
- **[Test por articulo](/test/articulo)** - Practica un articulo concreto
- **[Repaso de fallos](/test/repaso-fallos)** - Repasa preguntas que has fallado
- **[Psicotecnicos](/psicotecnicos/test)** - Series numericas, alfabeticas, analogias, dominos...
- **[Mantener racha](/test/mantener-racha)** - Test rapido para no perder tu racha diaria`
  }

  // Test Multi-Ley (varias leyes, diferentes leyes, combinar leyes)
  if (/multi[- ]?ley|(varias|diferentes|m[uú]ltiples|distintas)\s+leyes|combinar\s+(leyes|normativa)|mezclar\s+(leyes|preguntas)|test\s+de\s+.*leyes/i.test(msgLower)) {
    return `📚 **¡Sí! En Vence puedes hacer tests combinando varias leyes**

👉 **[Ir al Configurador Multi-Ley](/test/por-leyes)**

**Características:**
- ✅ Selecciona las leyes que quieras (CE, LPAC, LRJSP, TREBEP...)
- ✅ Buscador para encontrar leyes rápidamente
- ✅ Las preguntas se reparten equitativamente entre las leyes
- ✅ Guarda tus combinaciones favoritas para reutilizarlas
- ✅ Configura número de preguntas, dificultad y más

**Ejemplo:** Si seleccionas CE + LPAC + LRJSP y pides 30 preguntas, saldrán 10 de cada ley.

💡 ¡Ideal para repasar varias leyes relacionadas o simular exámenes reales!`
  }

  return null
}

// Re-exportar tipos y funciones útiles
export { isPlatformQuery, detectCategory, type KBCategory }
