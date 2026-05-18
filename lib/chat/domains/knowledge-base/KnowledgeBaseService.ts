// lib/chat/domains/knowledge-base/KnowledgeBaseService.ts
// Servicio principal de la base de conocimiento

import { generateEmbedding } from '../search/EmbeddingService'
import {
  searchKnowledgeBase,
  searchKnowledgeBaseByKeywords,
  searchHelpArticles,
  detectCategory,
  isPlatformQuery,
  extractPlatformKeywords,
  type KnowledgeBaseEntry,
  type KBCategory,
  type HelpArticle,
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

  // 3. Intentar búsqueda en help_articles (RAG) primero
  try {
    const { embedding } = await generateEmbedding(message)

    // 3a. Buscar en help_articles (contenido curado de la plataforma)
    const helpArticles = await searchHelpArticles(embedding, { threshold: 0.35, limit: 3 })
    if (helpArticles.length > 0 && helpArticles[0].similarity > 0.40) {
      // Convertir HelpArticle a KnowledgeBaseEntry para compatibilidad
      const entries: KnowledgeBaseEntry[] = helpArticles.map(ha => ({
        id: ha.id,
        category: ha.category as KBCategory,
        subcategory: null,
        title: ha.title,
        content: ha.content,
        shortAnswer: null,
        keywords: ha.keywords,
        metadata: { slug: ha.slug, relatedUrls: ha.relatedUrls },
        similarity: ha.similarity,
        priority: 10, // Alta prioridad para help_articles
      }))

      logger.info(`Help articles RAG: ${entries.length} results (best: ${(helpArticles[0].similarity * 100).toFixed(1)}%)`, {
        domain: 'knowledge-base',
        slugs: helpArticles.map(h => h.slug),
      })

      return {
        entries,
        category,
        searchMethod: 'semantic' as const,
        confidence: Math.min(helpArticles[0].similarity + 0.2, 1),
      }
    }

    // 3b. Fallback: buscar en ai_knowledge_base (sistema anterior)
    const entries = await searchKnowledgeBase(embedding, {
      threshold: 0.40,
      limit: 3,
      category,
    })

    if (entries.length > 0) {
      const avgSimilarity = entries.reduce((sum, e) => sum + (e.similarity || 0), 0) / entries.length
      const confidence = Math.min(avgSimilarity + 0.2, 1)

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
export function getPredefinedResponse(
  message: string,
  options: { isPremium?: boolean } = {}
): string | null {
  const msgLower = message.toLowerCase()
  const { isPremium = false } = options

  // Mnemotécnicas: no tenemos servicio implementado (ni banco validado, ni
  // generador propio). Evitar invenciones tipo "PACO" inventada al vuelo.
  if (
    /memotecn|mnemotec/i.test(msgLower) ||
    /regla\s+(para\s+(recordar|no\s+olvidar|memorizar|el|la|las?|los)|mnemotec|memotec)/i.test(msgLower) ||
    /^regla\s+(para|de|mnemot|memot)/i.test(message.trim()) ||
    /truco\s+para\s+(recordar|memorizar|no\s+olvidar)/i.test(msgLower) ||
    /\bhay\s+una\s+de\s+\w{3,}/i.test(message) ||
    /\bla\s+de\s+[A-ZÁÉÍÓÚÑ]{3,}/.test(message)
  ) {
    return `Lo siento, no tengo este servicio implementado.`
  }

  // Cambiar foto / avatar de perfil (válido para móvil y desktop)
  if (/(mi\s+)?(foto|avatar|imagen\s+de\s+perfil)/i.test(msgLower)) {
    return `**Cambiar tu foto de perfil**

1. Pulsa en **tu avatar** (el círculo con tu imagen o emoji actual, arriba a la derecha de la pantalla)
2. En el menú que se abre, pulsa **"👤 Mi Perfil"**
3. En tu perfil, pulsa directamente **sobre tu avatar actual** (el círculo grande de la tarjeta)
4. Se abre un selector con dos opciones:
   - **Elegir un emoji** de las categorías disponibles (animales, profesiones, etc.)
   - **📸 Subir Imagen** — máximo 2 MB, formato JPG, PNG o GIF

Si la nueva foto no aparece tras subirla, cierra sesión y vuelve a entrar para forzar el refresco.

Si sigue sin funcionar, ábrelo como reporte desde **💬 Soporte** (mismo menú de tu avatar) y nuestro equipo lo revisa con una captura.`
  }

  // Cerrar sesión
  if (/(cerrar|salir\s+de\s+la)\s+sesi[oó]n/i.test(msgLower)) {
    return `**Cerrar sesión**

1. Pulsa en **tu avatar** (arriba a la derecha de la pantalla)
2. En el menú que se abre, baja hasta abajo
3. Pulsa el botón rojo **🚪 Cerrar Sesión**

Volverás a la pantalla de inicio. Cuando quieras volver a entrar, pulsa **"Continuar con Google"**.`
  }

  // Contraseña olvidada / no funciona / no recuerdo (Vence usa solo Google)
  if (/(olvid[eéó]|recuperar|no\s+recuerdo|no\s+(la|me)\s+(s[eé]|recuerdo|funciona))\s+(la\s+|mi\s+)?(contrase[ñn]a|password)/i.test(msgLower)
      || /(contrase[ñn]a|password)\s+(olvidad|olvidé|no\s+(la|me)\s+(s[eé]|recuerdo|funciona))/i.test(msgLower)) {
    return `**Contraseña olvidada**

En Vence no tienes contraseña propia — accedes con tu cuenta de **Google**.

Por eso, si has olvidado tu contraseña, tienes que recuperarla en Google directamente:

👉 [accounts.google.com/signin/recovery](https://accounts.google.com/signin/recovery)

Una vez que recuperes el acceso a tu Google, entra en Vence pulsando **"Continuar con Google"** como siempre.`
  }

  // Iniciar sesión / no puedo entrar (Vence = Google OAuth)
  if (/no\s+puedo\s+(entrar|iniciar\s+sesi[oó]n|acceder|loguearme|logearme|hacer\s+login)/i.test(msgLower)
      || /(iniciar|abrir)\s+sesi[oó]n/i.test(msgLower)
      || /\b(login|log\s*in)\b/i.test(msgLower)) {
    return `**Iniciar sesión en Vence**

Vence usa tu cuenta de Google para entrar (no hay usuario ni contraseña propios).

1. En la pantalla de acceso, pulsa **"Continuar con Google"**
2. Elige tu cuenta de Google y confirma el permiso

**Si no puedes entrar:**
- Verifica que tienes acceso a tu cuenta de Google
- Prueba en ventana privada/incógnito por si hay cookies bloqueando
- Desactiva temporalmente bloqueadores de anuncios o extensiones de privacidad
- Si usas varias cuentas de Google, elige la correcta en el selector

Si el botón "Continuar con Google" da error, escríbenos desde **💬 Soporte** (mismo menú de tu avatar) con una captura.`
  }

  // No puedo hacer test / no me deja / no me cuenta el progreso /
  // no se carga / no carga / por qué no se cargan los tests
  if (
    /no\s+(me\s+|se\s+)?(puedo|deja|sale|carga|cargan|funciona|funcionan|abre|abren)\s+.*(hacer|realizar|acceder\s+al?|los?|las?)?\s*(\w+\s+){0,2}(test|examen|pregunta|sim[iu]lacro)/i.test(msgLower) ||
    /por\s*qu[eé]\s+no\s+(me\s+|se\s+)?(puedo|deja|sale|carga|cargan|funciona|funcionan|abre|abren)\s+.*(test|pregunta|examen|sim[iu]lacro)/i.test(msgLower) ||
    /no\s+(me\s+|se\s+)?(cuenta|registra|guarda|contabiliza)\s+.*(test|pregunta|progreso|resultado|respuest)/i.test(msgLower) ||
    /(test|pregunta|examen|sim[iu]lacro)s?\s+(no\s+(se\s+)?(carga|cargan|funciona|funcionan|abre|abren))/i.test(msgLower)
  ) {
    // Personalizar según plan: usuarios Free ven primero el límite diario;
    // usuarios Premium NO lo ven (ya tienen tests ilimitados).
    const freeLimitBlock = !isPremium ? `**Causa más frecuente (cuenta gratuita): límite diario agotado**

Las cuentas gratuitas tienen un máximo de **25 preguntas al día**. Si lo has alcanzado, se reinicia automáticamente mañana.

👉 [Ver planes y pasarte a Premium](/premium) para tener tests ilimitados.

` : ''

    return `**No puedes hacer test o no se cuenta el progreso**

${freeLimitBlock}**${isPremium ? 'Posibles causas' : 'Otras causas posibles'}:**
- **No tienes oposición activa**: pulsa tu **avatar** (arriba a la derecha) → **"👤 Mi Perfil"** → sección **"📚 Preferencias de Estudio"** → **"🎯 Oposición Objetivo"** → **Seleccionar**.
- **La ley o tema no tiene preguntas para tu oposición**: prueba otra ley o usa **Test Aleatorio** (mezcla todas las leyes).
- **Cookies/extensiones bloqueando**: prueba en una ventana incógnito.

**Si el progreso no se cuenta correctamente:**

Cierra sesión y vuelve a entrar para forzar el refresco. Si tras eso sigue sin contar:

1. Pulsa tu **avatar** → **"💬 Soporte"**
2. Pulsa **"Abrir chat soporte"** y describe el problema (qué oposición, qué tema/ley, captura si puedes)`
  }

  // Primeros pasos / por dónde empezar / soy nuevo
  if (
    /no\s+s[eé]\s+por\s+d[oó]nde\s+empez/i.test(msgLower) ||
    /por\s+d[oó]nde\s+(puedo\s+)?empez(ar|o)/i.test(msgLower) ||
    /c[oó]mo\s+empiezo/i.test(msgLower) ||
    /\bsoy\s+nuevo\b/i.test(msgLower) ||
    /acabo\s+de\s+registr/i.test(msgLower) ||
    /primeros\s+pasos/i.test(msgLower)
  ) {
    return `**Primeros pasos en Vence**

👋 ¡Bienvenido! Aquí tienes el camino más corto para empezar a estudiar:

**1. Activa tu oposición**
- Pulsa en tu **avatar** (arriba a la derecha) → **"👤 Mi Perfil"** → sección **"📚 Preferencias de Estudio"** → en **"🎯 Oposición Objetivo"** pulsa **"Seleccionar"**.
- O entra desde el [catálogo de oposiciones](/oposiciones) si quieres ver primero todas las disponibles.

**2. Haz tu primer test (no necesitas saber nada todavía)**
- 👉 [Test rápido](/test/rapido): 10 preguntas mezcladas de tu oposición. Es el atajo para arrancar.
- Si aún no has activado oposición, te la pedirá antes de cargar el test.

**3. Cuando quieras profundizar**
- **Temario**: en la página de tu oposición, apartado "Temario", lees cada tema con sus leyes.
- **Test por tema**: practicas un tema concreto cuando ya lo has estudiado.
- **Test aleatorio**: mezcla preguntas de toda tu oposición (configurable).

**4. Sigue tu progreso**
- Tras cada test ves los aciertos y errores, y puedes repasar lo que fallaste.
- Tu **racha diaria** aparece junto al avatar — entrena un poco cada día para mantenerla.

Si te quedas atascado, vuelve a este chat y pregúntame.`
  }

  // Eliminar cuenta / darse de baja / borrar cuenta
  if (/eliminar\s+(mi\s+)?cuenta|borrar\s+(mi\s+)?cuenta|dar(me)?\s+de\s+baja/i.test(msgLower)) {
    return `**Eliminar tu cuenta**

1. Pulsa en **tu avatar** (arriba a la derecha)
2. Pulsa **"👤 Mi Perfil"**
3. Baja hasta el final de la página, hasta la sección **"⚠️ Zona de peligro"**
4. Pulsa el botón rojo **🗑️ Solicitar eliminación**
5. Confirma en el modal

Tu solicitud se procesa en **24-48 horas**. Recibirás un email de confirmación cuando la cuenta y todos tus datos queden eliminados. Hasta entonces puedes seguir usando la cuenta con normalidad.

⚠️ **Es irreversible**: se borran tus tests, progreso, suscripción y datos personales. No puede deshacerse después.`
  }

  // Problema de suscripcion / ya pagué pero no soy premium
  if (/(ya\s+)?pagu[eé]|he\s+pagado|hice\s+el\s+pago/i.test(msgLower) && /(no\s+(soy|eres|es)\s+premium|no\s+me\s+(deja|aparece|sale)|suscr[ií]b|no\s+tengo\s+premium|pone\s+free|sigue\s+(free|gratis))/i.test(msgLower)) {
    return `**Problema con tu suscripcion**

Si has realizado el pago pero no apareces como Premium, puede deberse a un retraso en la activacion.

**Pasos a seguir:**
1. Cierra sesion y vuelve a entrar
2. Comprueba en **[tu perfil](/perfil)** si aparece tu suscripcion
3. Si el problema persiste, contacta con soporte:

📧 **soporte@vence.pro**

Incluye tu email de registro y el comprobante de pago para que podamos resolverlo lo antes posible.`
  }

  // Cambiar de oposición / me sale otra oposición
  if (/cambiar\s+(de\s+)?oposici[oó]n|elegir\s+(otra\s+)?oposici[oó]n|seleccionar\s+(otra\s+)?oposici[oó]n|poner\s+(otra\s+)?oposici[oó]n|me\s+sale\s+(la\s+)?(oposici[oó]n|del\s+estado|otra)|no\s+(es\s+)?mi\s+oposici[oó]n|oposici[oó]n\s+(equivocada|incorrecta|mal)|c[oó]mo\s+(cambio|elijo|selecciono).*oposici[oó]n/i.test(msgLower)) {
    return `**Como cambiar de oposicion**

Puedes cambiar tu oposicion de dos formas:

**Opcion 1 - Desde tu perfil:**
1. Ve a **[tu perfil](/perfil)**
2. En la seccion "Tu oposicion", pulsa **"Cambiar"**
3. Selecciona la nueva oposicion
4. Guarda los cambios

**Opcion 2 - Acceso directo:**
Entra directamente a la pagina de tu oposicion. Por ejemplo:
- **[Auxiliar Administrativo Madrid](/auxiliar-administrativo-madrid)**
- **[Auxiliar Administrativo Estado](/auxiliar-administrativo-estado)**
- **[Tramitacion Procesal](/tramitacion-procesal)**

Puedes ver todas las oposiciones disponibles en **[Catálogo de Oposiciones](/oposiciones)**.

Al entrar a una oposicion y hacer un test, el sistema detecta automaticamente que quieres estudiar esa oposicion y la asigna a tu perfil.`
  }

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

  // Ver resultados / historial de tests y simulacros
  if (/(dame|ver|enseñ[aá]|muestra|dime)\s*(los\s*)?(resultado|estad[ií]stica|nota|puntuaci[oó]n)/i.test(msgLower) ||
      /resultado.*que\s*he\s*(hecho|sacado|obtenido)/i.test(msgLower) ||
      /resultado.*(sim[iu]lacro|examen|test)/i.test(msgLower) ||
      /historial\s*(de\s*)?(test|examen|sim[iu]lacro)/i.test(msgLower)) {
    return `**Como ver tus resultados**

1. Pulsa en tu **foto de perfil** (arriba a la derecha)
2. Veras un resumen rapido de tu progreso (racha, tests, aciertos)
3. Pulsa en **"Mis Estadisticas"** para ver el historial completo

Ahi encontraras todos tus tests completados con fecha, nota y desglose por ley.

👉 **[Ir directamente a Mis Estadisticas](/mis-estadisticas)**`
  }

  // Preparar / crear test personalizado (incluye variantes "preguntas", "cuestionario", "quiz")
  if (
    /prep[aá]ra(me|nos)?\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i.test(msgLower) ||
    /hazme\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i.test(msgLower) ||
    /me\s+(haces|creas|generas|preparas)\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i.test(msgLower) ||
    /puedes\s+(hacer|crear|generar|preparar)(me)?\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i.test(msgLower) ||
    /cr[eé]a(me)?\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i.test(msgLower) ||
    /gen[eé]ra(me)?\s+(un\s+)?(test|quiz|cuestionario|preguntas?)/i.test(msgLower) ||
    /quiero\s+(un\s+)?(test|quiz|cuestionario|practicar)\b/i.test(msgLower) ||
    /necesito\s+(un\s+)?(test|quiz|cuestionario)\b/i.test(msgLower)
  ) {
    return `**Crear un test personalizado**

En Vence puedes crear tests a medida eligiendo exactamente lo que quieres practicar:

👉 **[Crear test personalizado](/test/personalizado)**

**Puedes configurar:**
- **Leyes**: elige una o varias leyes concretas
- **Cantidad**: de 5 a 100 preguntas
- **Dificultad**: facil, media, dificil o mezcla
- **Solo preguntas oficiales**: preguntas de examenes reales
- **Solo preguntas falladas**: repasa tus puntos debiles

**Atajos rapidos:**
- **[Test por leyes](/test/por-leyes)** - Elige leyes y combinalas
- **[Test por articulo](/test/articulo)** - Practica un articulo concreto
- **[Simulacro de examen](/test/aleatorio-examen)** - Modo examen real`
  }

  // Preguntas de otros temas / mezcla de temas
  if (/selecciono\s+(un\s+)?tema.*preguntas?\s*(de\s+)?otro|por\s*qu[eé]\s*(me\s*)?(salen?|aparecen?|encuentro)\s*(preguntas?|temas?)\s*(de\s+)?otro/i.test(msgLower)) {
    return `**Preguntas de otros temas en tu test**

Es normal encontrar algunas preguntas que parecen de otro tema. Esto ocurre porque:

1. **Leyes compartidas**: Varios temas comparten las mismas leyes (ej: la Ley 39/2015 aparece en varios temas). Una pregunta puede estar vinculada a un artículo que se estudia en mas de un tema.

2. **Preguntas transversales**: Algunas preguntas de examenes oficiales tocan conceptos que cruzan varios temas del temario.

**Opciones para practicar mas enfocado:**
- **[Test por leyes](/test/por-leyes)** - Elige una ley concreta
- **[Test por articulo](/test/articulo)** - Practica un articulo especifico
- **[Test personalizado](/test/personalizado)** - Configura exactamente lo que quieres

Si crees que una pregunta esta mal clasificada, puedes impugnarla pulsando el boton de impugnar tras responderla.`
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

  // Imprimir tests / resultados
  if (/imprim(ir|o|e|imos)\s+(los\s+)?(test|resultado|examen|pregunta)/i.test(msgLower) || /c[oó]mo\s+(imprimo|guardo)\s+(los\s+)?test/i.test(msgLower) || /los\s+test.*imprimo/i.test(msgLower)) {
    return `**Tus tests y resultados**

Los tests que realizas se guardan automaticamente. Puedes consultarlos en:

👉 **[Mis estadisticas](/mis-estadisticas)** → pestaña **General**

**Ahi puedes ver:**
- Tests completados con puntuacion y fecha
- Preguntas acertadas, falladas y en blanco
- Tiempo medio por pregunta
- Racha de estudio

**Para revisar un test concreto:**
- En Mis estadisticas, pulsa sobre cualquier test para ver todas las preguntas con sus respuestas y explicaciones

**Para repasar lo que has fallado:**
- 👉 **[Repaso de fallos](/test/repaso-fallos)** - Practica solo las preguntas que fallaste`
  }

  // Imprimir temario / PDF
  if (/imprim(ir|o|e)\s+(el\s+)?(temario|tema|articulo|ley)/i.test(msgLower) || /descargar\s+(el\s+)?(temario|tema|pdf)/i.test(msgLower) || /\bpdf\b/i.test(msgLower) || /temario.*pdf/i.test(msgLower)) {
    return `**Imprimir temario en PDF**

Si, puedes imprimir cualquier tema del temario:

1. Ve a **[Temario](/temarios)** y selecciona el tema que quieras
2. Dentro del tema, pulsa el boton **"Imprimir PDF"** (esta en la parte superior)
3. En el dialogo de impresion, elige **"Guardar como PDF"** para descargarlo

El PDF se genera con formato optimizado para impresion (margenes, saltos de pagina, sin menus).`
  }

  // Guardar test / descargar resultados
  if (/guardar\s+(el\s+)?(test|resultado|examen)/i.test(msgLower) || /descargar\s+(mis\s+)?(resultado|estadistic)/i.test(msgLower) || /exportar/i.test(msgLower)) {
    return `**Guardar y consultar resultados**

Todos tus tests se guardan automaticamente. No necesitas hacer nada especial.

**Donde los encuentras:**
- 👉 **[Mis estadisticas](/mis-estadisticas)** → pestaña **General**: ves todos los tests que has hecho
- Pulsa sobre cualquier test para revisar las preguntas, respuestas y explicaciones
- En la pestaña **Analisis de fallos** puedes ver patrones en tus errores
- En la pestaña **Rendimiento** ves tu progreso por tema y dificultad

Actualmente no hay opcion de exportar a CSV o Excel, pero puedes usar la impresion del navegador (Ctrl+P) para guardar como PDF.`
  }

  // Mis estadísticas / dónde veo mis resultados
  if (/mis\s+(estadistic|resultado|test|nota)|d[oó]nde\s+veo\s+(mis|lo|los|las)\s+(estadistic|resultado|test|nota|fallo|progre)/i.test(msgLower) || /historial\s+de\s+test/i.test(msgLower)) {
    return `**Tus estadisticas y progreso**

👉 **[Mis estadisticas](/mis-estadisticas)**

**5 pestañas disponibles:**
- 📊 **General** - Tests realizados, puntuacion, racha, tiempo de estudio
- 🔍 **Analisis de fallos** - Patrones de error y areas debiles
- 📈 **Rendimiento** - Progreso por tema, dificultad y articulo
- 🔮 **Predicciones** - Probabilidad de aprobar y ritmo de mejora
- 🧩 **Psicotecnicos** - Resultados de tests psicotecnicos

Tambien puedes pulsar sobre cualquier test completado para revisarlo pregunta por pregunta.`
  }

  // Impugnaciones / disputas — requiere contexto de plataforma (pregunta/test/cuestión/...)
  // o expresiones específicas. El regex anterior matcheaba "impugnado" del uso legal
  // (ej: "acto impugnado"), devolviendo respuesta off-topic sobre el sistema de impugnaciones.
  if (
    /\bimpugn\w*\s+(una\s+|la\s+|de\s+|mi\s+|las\s+|los\s+|esta\s+|este\s+|ese\s+|esa\s+)?(pregunta|respuesta|cuesti[oó]n|test|examen|tests)/i.test(msgLower) ||
    /\b(mis|ver|las|como|c[oó]mo|d[oó]nde)\s+impugnaci/i.test(msgLower) ||
    /\bdisputar?\b\s+(una\s+|la\s+|mi\s+)?(pregunta|respuesta|cuesti[oó]n|test)/i.test(msgLower) ||
    /reportar\s+(una\s+)?pregunta/i.test(msgLower)
  ) {
    return `**Sistema de impugnaciones**

Si encuentras una pregunta con error, puedes impugnarla:

👉 **[Ver mis impugnaciones](/mis-impugnaciones)**

**Como funciona:**
- Al responder una pregunta, pulsa el boton de impugnar
- Describe el error que has encontrado
- Un administrador revisara tu impugnacion
- Puedes ver el estado (pendiente, resuelta, rechazada) en tu panel`
  }

  // Convocatorias — solo si el usuario pide CLARAMENTE consultar el catálogo,
  // no como mención casual ("me cuesta ponerme con la convocatoria..." NO
  // debe disparar respuesta de catálogo).
  // Caso real: usuario pedía motivación, el regex genérico "convocatoria"
  // disparaba el link al catálogo y rompía el flujo emocional.
  const isConvocatoriaQuery =
    /^\s*convocatorias?\b/i.test(msgLower) ||
    /\b(cu[aá]l(es)?|qu[eé]|d[oó]nde|cómo)\s+(son\s+las?|hay\s+las?|veo\s+las?|consulto\s+las?|encuentro\s+las?)?\s*convocatorias?/i.test(msgLower) ||
    /(ver|consultar|buscar|listar|filtrar|hay)\s+(las?\s+)?convocatorias?\b/i.test(msgLower) ||
    /plazas?\s+(disponibles?|ofertadas?|publicadas?|hay)/i.test(msgLower)
  if (isConvocatoriaQuery) {
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
