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

// ══════════════════════════════════════════════════════════════════════════════════════════
// LISTA DE LO PERMITIDO, NO DE LO PROHIBIDO — y esto es una CORRECCIÓN. (T-612, 06/08)
//
// La primera versión de este fichero (05/08) era una lista de lo PROHIBIDO: se enumeraban las
// familias peligrosas y **todo lo demás pasaba**. Sonaba razonable y estaba mal, con una
// consecuencia medida al día siguiente: los cinco worktrees de trabajador del VPS acabaron con
// un `.env.local` de 9.670 bytes que este mismo filtro había producido —lleva sus motivos
// literales dentro— con `DATABASE_URL=venceadmin` (ESCRITURA TOTAL en la BD de producción),
// `AWS_ACCESS_KEY_ID/SECRET`, `GITHUB_PAT`, `SUPABASE_SERVICE_ROLE_KEY` y `VERCEL_TOKEN`.
//
// Ninguna de esas cinco estaba prohibida. No porque se decidiera que podían viajar, sino porque
// **nadie las escribió en la lista**. Lo encontró un trabajador (w3) auditando por su cuenta, no
// una alerta nuestra.
//
// Una lista de lo prohibido protege de lo que ya sabes; una de lo permitido protege de lo que no
// se te ocurrió. La credencial que se filtre mañana será justo la que nadie previó, así que el
// criterio se invierte: **si no está declarado, NO viaja.**
//
// Nota de alcance: un trabajador NO debería recibir un `.env.local` derivado en absoluto — el suyo
// lo CONSTRUYE `arrancar-trabajador.sh` con la coordinación y la lectura, y nada más. Este filtro
// es la red por si alguien vuelve a derivarlo; que sea una red no lo exime de fallar cerrado.
// ══════════════════════════════════════════════════════════════════════════════════════════

/** Lo ÚNICO que viaja. Añadir aquí es una decisión consciente y revisable en el diff. */
const VIAJAN = [
  // Públicas por definición: van inlineadas en el bundle que sirve el navegador, así que
  // excluirlas no protegería nada y rompería cualquier build.
  { patron: /^NEXT_PUBLIC_/, porque: 'pública por definición (viaja al navegador)' },
  // Config sin secreto que el andamiaje necesita para comportarse igual que en el portátil.
  { patron: /^(NODE_ENV|TZ|LANG|LC_ALL)$/, porque: 'configuración sin secreto' },
  // Las credenciales ACOTADAS del trabajador: la de coordinarse y la de diagnosticar. Son roles
  // con permisos recortados, no las del portátil.
  { patron: /^VENCE_(COORDINACION|LECTOR)_URL$/, porque: 'credencial acotada del trabajador' },
  { patron: /^VENCE_SESSION_(ROLE|HOME|HOST)$/, porque: 'identidad de la sesión, la declara quien arranca' },
]

/**
 * Familias que se nombran EXPRESAMENTE aunque la lista de permitidos ya las excluya.
 *
 * No es redundancia inútil: al quedar fuera, el motivo que se imprime sería el genérico («no está
 * declarada»), y quien abra el fichero no sabría si falta por descuido o a propósito. Con esto, el
 * `.env.local` de un trabajador explica POR QUÉ no tiene la clave — que es la diferencia entre
 * entenderlo y perder dos horas buscándola.
 */
const MOTIVO_EXPLICITO = [
  { patron: /^STRIPE_SECRET_KEY/, motivo: 'clave sk_live: cobra y reembolsa dinero real' },
  { patron: /^STRIPE_WEBHOOK_SECRET/, motivo: 'permite falsificar eventos de pago' },
  { patron: /^BITREFILL_/, motivo: 'compra vales regalo: dinero real' },
  { patron: /^GOOGLE_ADS_/, motivo: 'gasta presupuesto de campañas' },
  { patron: /^META_(ACCESS_TOKEN|ADS_)/, motivo: 'gasta presupuesto de campañas' },
  { patron: /^(EMAIL_|RESEND|SENDGRID)/, motivo: 'envía correo a personas: lo aprueba una persona' },
  { patron: /^AUTH_SECRET$/, motivo: 'acuña tokens de sesión de cualquier usuario' },
  { patron: /^ARMANDO_SESSION_SECRET$/, motivo: 'secreto de sesión' },
  // Las cinco que el filtro de lo-prohibido dejó pasar el 05/08, nombradas para que su ausencia
  // se lea como deliberada y para que nadie las vuelva a añadir «porque hacían falta».
  { patron: /^DATABASE_URL$/, motivo: 'es venceadmin: ESCRITURA TOTAL en producción. La suya la escribe arrancar-trabajador.sh' },
  { patron: /^AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN)$/, motivo: 'despliega y lee SSM: fuera del alcance de un trabajador' },
  { patron: /^GITHUB_PAT$/, motivo: 'empuja a main saltándose los guardarraíles del pre-push' },
  { patron: /^SUPABASE_SERVICE_ROLE_KEY$/, motivo: 'salta RLS: lee y escribe datos de cualquier usuario' },
  { patron: /^VERCEL_TOKEN$/, motivo: 'despliega a producción sin pasar por el candado ni por CI' },
]

/** Compatibilidad: lo que ya no viaja, para quien lo importe. Se deriva, no se mantiene aparte. */
const NO_VIAJAN = MOTIVO_EXPLICITO

/**
 * ¿Viaja esta variable al entorno de un trabajador?
 * @returns {{viaja: boolean, motivo: string|null}}
 */
function decidirVariable(nombre) {
  // El motivo EXPRESO manda sobre todo lo demás: si una familia peligrosa acabara casando con un
  // permitido por accidente (un `NEXT_PUBLIC_` mal nombrado, por ejemplo), gana el rechazo.
  for (const r of MOTIVO_EXPLICITO) {
    if (r.patron.test(nombre)) return { viaja: false, motivo: r.motivo }
  }
  for (const r of VIAJAN) {
    if (r.patron.test(nombre)) return { viaja: true, motivo: null }
  }
  // POR DEFECTO NO VIAJA. Este `return` es el arreglo entero: antes decía `viaja: true`.
  return { viaja: false, motivo: 'no está declarada en la lista de lo permitido' }
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

module.exports = { VIAJAN, MOTIVO_EXPLICITO, NO_VIAJAN, decidirVariable, filtrarEntorno }
