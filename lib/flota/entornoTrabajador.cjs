// lib/flota/entornoTrabajador.cjs — el entorno del trabajador se GENERA, no se copia. (T-486)
//
// ── POR QUÉ ────────────────────────────────────────────────────────────────────────────────
// El 05/08/2026 se les dio el entorno completo para que pudieran resolver tareas profundas —
// decisión de Manuel, y correcta: sin poder leer `user_profiles` no podían ni poner el nombre en
// un saludo, y cuatro borradores murieron en «BLOQUEADO, no pude analizarlo» por no poder leer
// `target_oposicion`.
//
// Pero se hizo copiando el `.env.local` entero, y ahí iban **dos claves `sk_live` de Stripe**, el
// token de Bitrefill (compra vales de verdad) y los de Google/Meta Ads (gastan presupuesto). Nada
// de eso hace falta para el trabajo que la flota hace de verdad: `lib/flota/encargo.cjs` ya
// descarta del reparto automático toda tarea de dinero («toca dinero: fuera del alcance»).
//
// La capa fuerte no es una puerta de código: es **no mandar la credencial**. Una puerta se puede
// olvidar en el siguiente script; una clave que no está en la máquina no está.
//
// ── QUÉ SE QUITA Y QUÉ NO ──────────────────────────────────────────────────────────────────
// Se quita lo que MUEVE DINERO o ENVÍA A UNA PERSONA. Se queda todo lo demás — BD, AWS, el
// proveedor de IA, los datos de negocio — porque quitarlo sí los limitaría para su trabajo, que
// es justo lo que no queremos.
//
// Es una LISTA NEGRA por prefijo, no una blanca, a propósito: con lista blanca, una variable nueva
// que haga falta para trabajar llega vacía y el trabajador se atasca sin saber por qué. Con lista
// negra, lo que se cuela es una variable inocua. El error barato es el que se prefiere.

/** Prefijos de variables que NO viajan a un trabajador autónomo, con el porqué de cada familia. */
const NO_VIAJAN = [
  { patron: /^STRIPE_SECRET_KEY/, motivo: 'clave sk_live: cobra y reembolsa dinero real' },
  { patron: /^STRIPE_WEBHOOK_SECRET/, motivo: 'permite falsificar eventos de pago' },
  { patron: /^BITREFILL_/, motivo: 'compra vales regalo: dinero real' },
  { patron: /^GOOGLE_ADS_/, motivo: 'gasta presupuesto de campañas' },
  { patron: /^META_(ACCESS_TOKEN|ADS_)/, motivo: 'gasta presupuesto de campañas' },
  { patron: /^(EMAIL_|RESEND|SENDGRID)/, motivo: 'envía correo a personas: lo aprueba una persona' },
  { patron: /^AUTH_SECRET$/, motivo: 'acuña tokens de sesión de cualquier usuario' },
  { patron: /^ARMANDO_SESSION_SECRET$/, motivo: 'secreto de sesión' },
]

// Las `NEXT_PUBLIC_STRIPE_*` SÍ viajan: son públicas por definición (van inlineadas en el bundle
// que sirve el navegador). Excluirlas no protegería nada y rompería cualquier build local.

/**
 * ¿Viaja esta variable al entorno de un trabajador?
 * @returns {{viaja: boolean, motivo: string|null}}
 */
function decidirVariable(nombre) {
  for (const r of NO_VIAJAN) {
    if (r.patron.test(nombre)) return { viaja: false, motivo: r.motivo }
  }
  return { viaja: true, motivo: null }
}

/**
 * Filtra un fichero de entorno completo dejando el del trabajador.
 *
 * Conserva el fichero TAL CUAL (comentarios, líneas en blanco, orden): solo comenta las líneas
 * que no viajan, con su motivo al lado. Así, quien abra el `.env.local` de un trabajador ve QUÉ
 * le falta y POR QUÉ, en vez de encontrarse un hueco — que es como se pierden dos horas buscando
 * una variable que alguien quitó a propósito.
 *
 * @param texto  contenido del .env completo
 * @returns {{texto: string, quitadas: Array<{nombre, motivo}>}}
 */
function filtrarEntorno(texto) {
  const quitadas = []
  const salida = String(texto || '').split('\n').map((linea) => {
    const m = linea.match(/^([A-Z_][A-Z0-9_]*)=/)
    if (!m) return linea
    const v = decidirVariable(m[1])
    if (v.viaja) return linea
    quitadas.push({ nombre: m[1], motivo: v.motivo })
    return `# [flota] ${m[1]} no viaja a un trabajador — ${v.motivo}`
  }).join('\n')
  return { texto: salida, quitadas }
}

module.exports = { NO_VIAJAN, decidirVariable, filtrarEntorno }
