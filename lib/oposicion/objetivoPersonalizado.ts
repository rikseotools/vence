// lib/oposicion/objetivoPersonalizado.ts — una oposición PERSONALIZADA como objetivo. (T-327)
//
// Helpers PUROS, al estilo de `decideLoad` y `resolveUserOposicion`, y por el mismo motivo:
// `OposicionContext` es 'use client' y no se puede montar en un test puro, pero lo que decide
// aquí afecta a **la navegación de todos los usuarios**.
//
// ── EL PROBLEMA QUE RESUELVE ────────────────────────────────────────────────────────────────
//
// La oposición objetivo (`user_profiles.target_oposicion`) se valida contra `ALL_OPOSICION_IDS`,
// que es un catálogo ESTÁTICO del código. Una oposición personalizada vive en la base de datos,
// así que no está ahí — y el contexto la trata como **dato sucio**: borra la oposición del
// usuario, le pone el menú por defecto y le enseña «selecciona tu oposición»
// (`OposicionContext.tsx`, rama `invalid`).
//
// O sea que, sin esto, dejar elegir una personalizada no es que «no funcione»: **le rompe la
// navegación** a quien la elija.
//
// ── LA REGLA QUE NO ES OBVIA: SIN NOMBRE NO ES VÁLIDA ───────────────────────────────────────
//
// Una personalizada solo se acepta como objetivo si además **se sabe cómo se llama**. El nombre
// no está en ningún catálogo: viene del blob `target_oposicion_data`. Si ese blob falta (pasa —
// hubo 428 perfiles con `target_oposicion` puesto y el blob a NULL por un write path parcial),
// aceptarla dejaría al usuario con una oposición **sin nombre** en la cabecera y en todos los
// selectores. Eso es PEOR que mandarle a arreglarla: un estado roto y mudo frente a uno roto que
// al menos pide ayuda. Así que sin nombre → sigue siendo `invalid`, como hasta hoy.

/** Prefijo del `position_type` que genera `lib/api/oposicionPersonalizada/plan.ts`. */
const PREFIJO = 'personalizada_'

/**
 * Primeros segmentos de ruta que NO son una oposición aunque sigan de `/test` o `/temario`.
 * Son secciones transversales de la app, enlazadas desde cualquier pantalla con toda
 * legitimidad. Ver `enlaceSaleAOtraOposicion`.
 */
const SECCIONES_NO_OPOSICION = new Set(['psicotecnicos', 'leyes', 'teoria', 'test', 'admin', 'api'])

/**
 * ¿Este identificador es una oposición personalizada CON temario?
 *
 * Se exige el prefijo a propósito. El onboarding antiguo guardaba el **UUID pelado** de
 * `custom_oposiciones` como objetivo, y esas filas son solo una etiqueta: no tienen `topics` ni
 * `topic_scope` detrás (medido el 30/07: 303 usuarios así, 127 sin un solo test). Aceptarlas
 * aquí las daría por buenas y el usuario acabaría en un temario vacío — que es exactamente el
 * problema que T-327 viene a resolver, no a extender.
 */
export function esObjetivoPersonalizado(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(PREFIJO) && id.length > PREFIJO.length
}

/** El id de `custom_oposiciones` que hay dentro del identificador (sin guiones). */
export function idCustomDe(objetivo: string): string | null {
  if (!esObjetivoPersonalizado(objetivo)) return null
  return objetivo.slice(PREFIJO.length)
}

/**
 * ¿Esta personalizada se puede ESTUDIAR, o es solo una etiqueta? [T-508]
 *
 * ── LA FILA SIGNIFICA DOS COSAS Y NADA EN ELLA LO DICE ───────────────────────────────────────
 *
 * `custom_oposiciones` lleva viva desde diciembre de 2025 guardando lo que el onboarding viejo
 * llamaba «mi oposición no está en vuestro catálogo»: un NOMBRE y nada más. T-327 montó encima
 * de esa misma tabla el creador de temario propio. Medido el 03/08/2026: de 585 filas activas,
 * **580 son etiqueta pura** (0 temas) y solo 5 tienen temario — todas de agosto.
 *
 * Ninguna columna distingue las dos cosas, así que cada lector tiene que deducirlo contando
 * temas. El primero que se olvidó de deducirlo produjo el 404 que abre esta tarea: una usuaria
 * premium fijó como objetivo su etiqueta de marzo y el icono 📚 del Header la mandó a una página
 * que no existe.
 *
 * ── POR QUÉ VIVE AQUÍ Y NO EN CADA PUERTA ───────────────────────────────────────────────────
 *
 * Porque hay DOS sitios que deciden lo mismo —el botón «Hacer mi oposición objetivo» y el PUT de
 * `/api/profile/target`— y dos puertas con criterios propios se separan a la primera. La de
 * verdad es la del servidor; la del botón está para que el usuario no llegue a chocar con ella.
 *
 * @param temasActivos temas con `is_active` del `position_type` de esa personalizada
 */
export function personalizadaUtilizable(temasActivos: number | null | undefined): boolean {
  return typeof temasActivos === 'number' && Number.isFinite(temasActivos) && temasActivos > 0
}

/**
 * ¿Es válido este objetivo? Es la pregunta que hoy contesta `ALL_OPOSICION_IDS.includes(id)`.
 *
 * ⚠️ Esto es el camino de LECTURA: contesta «¿sé pintar este objetivo?», no «¿se puede fijar?».
 * A quien YA está en el estado roto no se le invalida el objetivo —eso le dejaría además sin
 * menú—: se le enseña el temario vacío explicado. Quien decide si se PUEDE fijar es
 * `personalizadaUtilizable`, en el punto de escritura.
 *
 * @param id            `target_oposicion`
 * @param estaEnCatalogo si el id está en el catálogo estático
 * @param nombreDelBlob  `target_oposicion_data.name` (o `nombre`), si vino
 */
export function esObjetivoValido(
  id: string | null | undefined,
  estaEnCatalogo: boolean,
  nombreDelBlob: string | null | undefined,
): boolean {
  if (!id) return false
  if (estaEnCatalogo) return true
  // Personalizada: válida SOLO si sabemos nombrarla (ver cabecera).
  return esObjetivoPersonalizado(id) && typeof nombreDelBlob === 'string' && nombreDelBlob.trim() !== ''
}

/**
 * RAÍZ de una oposición personalizada: el prefijo del que cuelgan todas sus páginas.
 *
 * Es la primitiva que faltaba. El Header la necesitaba y la sacaba quitándole el `/test` a
 * `rutaTestPersonalizada` (`.replace(/\/test$/, '')`), que es la señal clásica de que el
 * concepto existía sin nombre: en cuanto una segunda pantalla lo necesitó —la página del tema
 * del temario, [T-541]— el atajo no se podía reutilizar y se acabó tirando de un DEFAULT que
 * apuntaba a otra oposición.
 *
 * Devuelve `null` para lo que no sea personalizado, igual que sus hermanas, para que el
 * llamante siga por su camino de siempre.
 */
export function raizPersonalizada(id: string | null | undefined): string | null {
  if (!esObjetivoPersonalizado(id)) return null
  return `/oposicion-personalizada/${idCustomDe(id as string)}`
}

/**
 * Ruta de los tests de un objetivo personalizado.
 *
 * Las del catálogo van a `/{slug}/test`, pero una personalizada no tiene slug ni página propia:
 * se sirve desde su `topic_scope` en una ruta por id. Devolver `null` para lo que no sea
 * personalizado deja que el llamante siga usando su camino de siempre.
 */
export function rutaTestPersonalizada(id: string | null | undefined): string | null {
  const raiz = raizPersonalizada(id)
  return raiz && `${raiz}/test`
}

/**
 * La raíz personalizada que hay EN UNA RUTA, si la hay. [T-541]
 *
 * Es la señal más fuerte de las dos: el perfil dice cuál es TU oposición, pero la URL dice cuál
 * estás mirando, y no tienen por qué coincidir — las personalizadas son públicas. Por eso los
 * enlaces de una pantalla se construyen desde aquí primero y desde el perfil después.
 *
 * Existe porque `resolveOposicionSlugForNav` solo conoce el catálogo ESTÁTICO: dentro de una
 * personalizada no casa ningún segmento, el `target_oposicion` tampoco está en sus mapas, y
 * devuelve la flagship. Así, al terminar un test propio, «Volver al Tema» y «Ver Otros Temas»
 * llevaban a `/auxiliar-administrativo-estado/…`.
 */
export function raizPersonalizadaEnRuta(pathname: string | null | undefined): string | null {
  if (typeof pathname !== 'string') return null
  const m = pathname.match(/^\/oposicion-personalizada\/([0-9a-f]{32})(?:\/|$)/i)
  return m ? `/oposicion-personalizada/${m[1]}` : null
}

/**
 * ¿Este enlace SACA al usuario de su oposición personalizada y lo mete en otra? [T-541]
 *
 * ── EL FALLO QUE LO PIDE ────────────────────────────────────────────────────────────────────
 *
 * La página del tema de una personalizada reutiliza el `TopicContentView` de
 * `administrativo-estado`, y ese componente tiene el slug de su oposición como valor POR
 * DEFECTO. La página no le pasaba el suyo, así que sus cuatro enlaces (tema anterior, tema
 * siguiente, la miga «Temario» y «Practicar este tema») salían apuntando a
 * `/administrativo-estado/...`. Un premium (Sergio, 04/08/2026) pulsó «Practicar este tema» y
 * acabó estudiando el temario del Estado creyendo que era el suyo.
 *
 * Un default que es una oposición REAL no rompe nada: **teletransporta**. Por eso hace falta
 * una regla que lo diga en voz alta.
 *
 * ── POR QUÉ ESTA FORMA Y NO «¿está en el catálogo?» ─────────────────────────────────────────
 *
 * Se mira la FORMA de la ruta (`/<algo>/test|temario`), no una lista de slugs, porque la lista
 * es un catálogo estático que hay que mantener y que ya se quedó corto una vez (es justo lo que
 * deja fuera a las personalizadas, ver cabecera del fichero). La forma no envejece.
 *
 * NO cuentan como fuga los enlaces que un temario tiene legítimamente hacia fuera: `/leyes/...`
 * (practicar una ley suelta), `/teoria`, `/oposiciones`, `/perfil` y demás enlaces comunes del
 * Header — ninguno tiene la forma «oposición».
 */
export function enlaceSaleAOtraOposicion(
  href: string | null | undefined,
  raiz: string | null | undefined,
): boolean {
  if (typeof href !== 'string' || !href.startsWith('/')) return false
  if (!raiz) return false
  const limpia = href.split('?')[0].split('#')[0]
  if (limpia === raiz || limpia.startsWith(`${raiz}/`)) return false
  // Forma de página de oposición del catálogo: /<slug>/test… o /<slug>/temario…
  const m = limpia.match(/^\/([a-z0-9-]+)\/(?:test|temario)(?:\/|$)/)
  if (!m) return false
  // …salvo las SECCIONES de la app que casualmente tienen esa forma. `/psicotecnicos/test` es
  // el enlace común del Header, no la oposición «psicotecnicos»; medido contra producción el
  // 04/08/2026, era 14 de las 17 señales del rastreo. Sin esta lista el detector grita en el
  // caso normal, que es la forma más rápida de que se deje de mirar.
  return !SECCIONES_NO_OPOSICION.has(m[1])
}
