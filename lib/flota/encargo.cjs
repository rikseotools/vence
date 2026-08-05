// lib/flota/encargo.cjs — QUÉ se le encarga a un trabajador de la flota, y qué NO. (T-486)
//
// ── EL PROBLEMA QUE RESUELVE ─────────────────────────────────────────────────────────────────
// Un trabajador arrancado sin encargo es una sesión de Claude Code mirando a la pared. Y el
// encargo no puede escribirse a mano cada vez: si cada quien improvisa el suyo, cada trabajador
// entiende su trabajo de una forma y el piloto deja de ser comparable consigo mismo.
//
// ── LO QUE DE VERDAD PROTEGE NO ES ESTE TEXTO ───────────────────────────────────────────────
// Conviene decirlo aquí porque es contraintuitivo: **la seguridad de la flota no está en el
// encargo, está en las credenciales**. Un trabajador tiene el rol `vence_coordinacion` —cuatro
// tablas, ninguna de negocio, ningún DELETE— y no tiene claves de AWS ni de Stripe. Aunque el
// encargo se ignorara por completo, no puede leer datos de un usuario, ni cobrar, ni desplegar.
//
// La lista de abajo no es la barrera: es evitar que pierda el tiempo cogiendo algo que no va a
// poder terminar, y que se meta donde hace falta criterio humano o hablar con una persona.

/** Familias de trabajo que NO son para un trabajador autónomo, con el motivo. */
const NO_APTAS = [
  { patron: /impugnaci|feedback|responder a|contestar a|usuari[oa]s?\b.*escrib/i,
    motivo: 'habla con una persona: el manual exige borrador y OK de Manuel antes de contestar' },
  { patron: /\bdespleg|\bdeploy\b|rollout/i,
    motivo: 'requiere desplegar, y un trabajador no tiene credenciales de AWS' },
  { patron: /stripe|cobro|pago|factur|suscripci|precio/i,
    motivo: 'toca dinero: fuera del alcance del piloto' },
  { motivo: 'decide algo que no es técnico (producto, prioridad, publicación)',
    patron: /decisi[oó]n de manuel|decidir si|go-?live|publicar la oposici/i },
  { patron: /newsletter|email a|campa[ñn]a/i,
    motivo: 'manda correo a personas reales' },
]

/**
 * ¿Es apta esta tarea para un trabajador autónomo?
 *
 * @param tarea  { id, title }
 * @returns {apta, motivo}
 *
 * Se juzga por el TÍTULO porque es lo que existe en la tabla y lo que decide `next`. Es una criba
 * conservadora, no un veredicto: ante la duda deja pasar, porque lo que impide el daño de verdad
 * es el permiso. Un filtro que se pasara de listo dejaría a la flota sin trabajo que hacer.
 */
function esApta(tarea) {
  const t = String((tarea && tarea.title) || '')
  if (!t.trim()) return { apta: false, motivo: 'sin título: no se puede juzgar' }
  for (const r of NO_APTAS) {
    if (r.patron.test(t)) return { apta: false, motivo: r.motivo }
  }
  return { apta: true, motivo: null }
}

/** De una lista de candidatas, la primera apta. Devuelve también las descartadas y por qué. */
function elegir(tareas) {
  const descartadas = []
  for (const t of tareas || []) {
    const v = esApta(t)
    if (v.apta) return { tarea: t, descartadas }
    descartadas.push({ id: t.id, motivo: v.motivo })
  }
  return { tarea: null, descartadas }
}

/**
 * El encargo permanente que se le manda a un trabajador. UN solo sitio.
 *
 * Va en español y en segunda persona porque lo lee un agente, no un humano; y lleva el «por qué»
 * de cada regla porque una regla sin motivo se salta en cuanto estorba — es la misma razón por la
 * que los guardarraíles de este repo explican su historia.
 */
function encargo({ trabajador, tarea }) {
  const cual = tarea
    ? `Tu tarea es **${tarea.id}**: ${tarea.title}`
    : 'Elige tarea tú: `node scripts/backlog.cjs next` y reclama la que te sugiera.'
  return [
    `Eres ${trabajador}, un TRABAJADOR de la flota de Vence. Trabajas solo, sin nadie mirando.`,
    '',
    cual,
    '',
    'ANTES DE NADA:',
    '  node scripts/backlog.cjs claim <id>     # imprime la ficha entera: léela',
    '  npm run sesion:preflight                # si sale con error, PÁRATE y no cojas trabajo',
    '',
    'REGLAS DURAS (no son consejos):',
    '  · NO pushees a main. Entregas ramas y un informe, no commits en la rama principal.',
    '  · NO despliegues, no escribas en la BD de negocio, no contestes a usuarios.',
    '  · Si un guardarraíl te para, NO lo rodees con un escape (*_SKIP). Párate y dilo.',
    '  · Verifica contra la FUENTE oficial, no contra lo que diga la ficha: las fichas se',
    '    equivocan, y la primera vuelta de este piloto lo demostró.',
    '',
    'AL TERMINAR, deja la tarea en un estado limpio con el CLI — nunca la abandones:',
    '  node scripts/backlog.cjs revision <id> --entrega "qué hay que revisar y dónde está"',
    '  (o `release <id>` si no has podido avanzar)',
    '',
    'Si necesitas una decisión de Manuel, no te quedes parado esperando:',
    '  node scripts/backlog.cjs preguntar "…" --tarea <id> [--bloquea]',
    '',
    'Trabaja con el método del repo: mira si la herramienta ya existe (`npm run tools:buscar`),',
    'intégrala en el runbook que ya lo cubre, y añade las capas que hagan falta.',
  ].join('\n')
}

module.exports = { NO_APTAS, esApta, elegir, encargo }
