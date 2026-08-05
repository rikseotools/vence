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
// El método NO se reescribe aquí: se trae del sitio donde ya vive (T-495). Dos copias del mismo
// texto acaban divergiendo, y entonces cada trabajador entiende su oficio de una forma.
const { METODO } = require('../sessions/recordatorio.cjs')

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
function encargo({ trabajador, tarea, puedeDesplegar = false }) {
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
    ...COLA_COMUN({ puedeDesplegar }),
  ].join('\n')
}

/**
 * Encargo para ANALIZAR una impugnación. (T-486, 05/08)
 *
 * ── POR QUÉ ESTO SÍ ES PARA UN TRABAJADOR, SI `esApta` LO DESCARTA ──────────────────────────
 * `esApta` descarta las impugnaciones del reparto AUTOMÁTICO por una razón concreta: acaban en un
 * correo a una persona. Eso sigue siendo cierto y sigue estando impedido — los scripts de envío se
 * niegan a funcionar con un trabajador (`lib/sessions/aprobacion.cjs`).
 *
 * Lo que cambia es que ahora **hay dónde dejar el borrador**. Y el trabajo de verdad de una
 * impugnación —abrir el dossier, contrastar contra el boletín oficial, decidir si procede y mirar
 * si el fallo es SISTÉMICO— es técnico, verificable y paralelizable. Lo único que no es suyo es
 * apretar el botón de enviar.
 *
 * La cola ya reparte sin colisiones (`cola.cjs`, claim atómico con FOR UPDATE SKIP LOCKED), así
 * que N trabajadores a la vez cogen N impugnaciones distintas sin coordinarse.
 */
function encargoImpugnacion({ trabajador, puedeDesplegar = false }) {
  return [
    `Eres ${trabajador}, un TRABAJADOR de la flota de Vence. Trabajas solo, sin nadie mirando.`,
    '',
    'Tu encargo: **analizar UNA impugnación de un usuario y dejar el borrador de respuesta**.',
    'NO la vas a enviar tú. Eso es de una persona, siempre.',
    '',
    'ANTES DE NADA — el manual manda, y sus reglas no se deducen de los datos:',
    '  docs/maintenance/impugnaciones-claude-code.md   ← LÉELO ENTERO PRIMERO',
    '  npm run sesion:preflight                        # si sale con error, PÁRATE',
    '',
    'EL CAMINO (una sola impugnación, nunca varias a la vez):',
    '  1. node scripts/impugnaciones/cola.cjs next          # te asigna UNA, en exclusiva',
    '  2. node scripts/impugnaciones/revisar-impugnacion.cjs <id>   # dossier + checklist de 9 puntos',
    '  3. Verifica contra la FUENTE OFICIAL (BOE/boletín), no contra lo que diga nuestra BD.',
    '     Si el enlace no abre el documento exacto, NO lo uses.',
    '  4. Decide: ¿procede o no? Y di POR QUÉ, con la cita literal del artículo.',
    '',
    '5. ¿ES SISTÉMICO? Es la pregunta obligatoria de toda impugnación, y la que más valor tiene:',
    '   ¿le pasa lo mismo a otras preguntas? MÍDELO con una consulta, no lo supongas.',
    '   · Si es un caso aislado → dilo en el borrador y sigue.',
    '   · Si afecta a más → abre ficha: `node scripts/backlog.cjs reserve "<título>" --esfuerzo <cajón>`',
    '     y luego `ficha <id> --texto <fichero.md>` con el NÚMERO de afectadas y cómo lo mediste.',
    '     Sin cifra no es un hallazgo, es una sospecha.',
    '   · Si el arreglo es acotado y no toca a usuarios, hazlo y entrégalo en tu rama.',
    '',
    '6. EL BORRADOR — es tu entregable, y es OBLIGATORIO:',
    '     node scripts/backlog.cjs borrador --para "impugnación <id> (<qué pide>)" --texto <fichero.md>',
    '   Escríbelo como se le escribe a una persona que estudia una oposición y ha dedicado tiempo',
    '   a avisarnos. Mira en el manual el tono y lo que NO se dice (no se detallan nuestros fallos,',
    '   no se menciona la IA, se firma «Equipo de Vence»). Corto. Sin explicar el proceso interno.',
    '',
    '7. NO cierres la impugnación ni ejecutes `cerrar.ts`: se negará contigo, y hace bien.',
    '   Cuando termines, suelta la fila: `node scripts/impugnaciones/cola.cjs release <id>`',
    '',
    ...COLA_COMUN({ puedeDesplegar }),
  ].join('\n')
}

/**
 * Lo que vale para CUALQUIER encargo. Un solo sitio: dos copias divergen y cada trabajador
 * acabaría entendiendo su oficio de una forma distinta.
 *
 * Es una FUNCIÓN y no una constante porque el final del ciclo depende de la máquina: quien puede
 * desplegar cierra la tarea él; quien no, la deja esperando al deploy.
 */
const COLA_COMUN = ({ puedeDesplegar = false } = {}) => [
    'REGLAS DURAS (no son consejos):',
    '  · NO pushees a main. Entregas ramas y un informe, no commits en la rama principal.',
    '  · NO despliegues, no escribas en la BD de negocio, no contestes a usuarios.',
    '  · Si un guardarraíl te para, NO lo rodees con un escape (*_SKIP). Párate y dilo.',
    '  · Verifica contra la FUENTE oficial, no contra lo que diga la ficha: las fichas se',
    '    equivocan, y la primera vuelta de este piloto lo demostró.',
    '',
    'LLEVA LA TAREA HASTA EL FINAL. No entregues a medias lo que puedes terminar tú:',
    '  1. Hazla. Con sus capas (test / guardarraíl / simulación) — el pre-push las exige.',
    '  2. Commit en TU rama y `git push origin HEAD:main` cuando esté completa.',
    ...(puedeDesplegar
      ? [
        '  3. DESPLIEGA si tu trabajo necesita estar vivo para poder comprobarse:',
        '       npm run deploy:pendiente          # 🔴 = hay trabajo terminado esperando',
        '       scripts/deploy-cuando-verde.sh <frontend|backend|both>',
        '     Espera a que el CI esté verde; el script ya lo comprueba y coge el candado.',
        '  4. VERIFÍCALO EN PRODUCCIÓN, no en local. Contra la URL real, con datos reales.',
        '     Un arreglo que no has visto funcionar vivo no está verificado, está supuesto.',
        '  5. CIERRA:  node scripts/backlog.cjs done <id> --outcome "qué se arregló y cómo lo comprobaste"',
        '     Si el outcome tiene que decir «falta» o «pendiente», entonces NO cierres: usa `pause`.',
      ]
      : [
        '  3. NO despliegues desde esta máquina: el candado del deploy es un `flock` local, así',
        '     que dos máquinas pueden desplegar a la vez y pisarse ([T-485]).',
        '     Deja la tarea esperando al deploy, que la despertará solo:',
        '       node scripts/backlog.cjs pause <id> --tras-deploy --superficie <frontend|backend|both> \\',
        '         --hecho "…" --falta "verificar en producción tras desplegar"',
      ]),
    '',
    'Y si de verdad no puedes terminarla, NUNCA la abandones — dilo con el CLI:',
    '  · `revision <id> --entrega "…"`  → hecho, pero necesita que lo mire una persona',
    '  · `pause <id> --hasta … --hecho "…" --falta "…"`  → esperando a algo',
    '  · `release <id>`  → no has podido avanzar',
    '',
    'CIERRA ANTES DE QUEDARTE SIN CONTEXTO. Cuando lleves el 80% consumido, PARA de abrir',
    'frentes y dedica lo que queda a cerrar ordenadamente: actualiza la ficha con lo medido,',
    'deja el estado con `revision` o `pause` (con --hecho y --falta), y escribe los cabos',
    'sueltos que hayas visto de paso. Lo que no esté escrito cuando se compacte, se pierde —',
    'y lo que se pierde no son los ficheros, son los porqués y los números que costaron horas.',
    '',
    'TU TURNO NO TIENE FUTURO: NO DEJES NADA «CORRIENDO EN SEGUNDO PLANO».',
    'Esto es un `claude -p`, de un solo tiro. Cuando termines de escribir, el proceso muere y NADIE',
    'recoge lo que dejaste esperando: ni un test en background, ni «lo miro cuando acabe», ni una',
    'notificación futura. Medido el 05/08: dos trabajadores acabaron su turno con la frase «me paro',
    'aquí a esperar a que termine la prueba en segundo plano» — la tarea se quedó COGIDA por nadie,',
    'el trabajo sin commitear y la máquina a carga 0,05 durante una hora.',
    'Si necesitas esperar a algo, ESPÉRALO EN PRIMER PLANO dentro de tu turno. Y si de verdad no',
    'cabe, cierra bien antes de terminar: commit de lo que tengas, y `pause` con --hecho/--falta o',
    '`revision --entrega`. Terminar sin soltar la tarea la bloquea para todos los demás.',
    '',
    'ANTES DE PREGUNTAR, PREGÚNTATE SI EL MÉTODO YA LO CONTESTA. La mayoría de las dudas que',
    'parecen una decisión son en realidad el criterio de la casa aplicado a un caso nuevo:',
    '  · «¿apago el guardarraíl o lo arreglo?» → se arregla. Un *_SKIP que se vuelve rutina es',
    '    cómo se han perdido protecciones aquí antes, y está medido.',
    '  · «¿lo cómodo o lo correcto?» → lo correcto, y si es más largo se dice cuánto.',
    '  · «¿meto una credencial de más para que pase?» → no. Se acota el permiso.',
    '  · «¿la ficha dice X pero yo he medido Y?» → manda lo MEDIDO, y se corrige la ficha.',
    'Si la respuesta se deduce de eso, no preguntes: hazlo y déjalo escrito. Preguntar lo que ya',
    'está contestado llena el embudo de ruido, y un embudo con ruido se deja de leer.',
    '',
    'PREGUNTA SOLO LO QUE DE VERDAD NECESITA A UNA PERSONA: lo que afecta a un usuario, a dinero,',
    'a lo que se publica, o donde hay dos caminos legítimos y elegir es cuestión de criterio de',
    'producto. Ahí no adivines — y no te quedes parado esperando:',
    '  node scripts/backlog.cjs preguntar "…" --tarea <id> [--bloquea]',
    'Di qué has medido y qué opciones ves: una pregunta con las opciones ya pensadas se contesta',
    'en un minuto; una sin ellas obliga a rehacer tu trabajo para poder responderte.',
    '',
    'NADA SALE HACIA UNA PERSONA SIN QUE MANUEL LO APRUEBE. Ni un correo, ni una respuesta a',
    'una impugnación o a un feedback, ni una newsletter. No es una formalidad: ahí es donde se',
    'detectan los fallos, y quien nos escribe necesita que haya alguien detrás. Si redactas algo',
    'que iría dirigido a alguien, déjalo donde él lo vea — nunca lo envíes tú:',
    '  node scripts/backlog.cjs borrador --para "<a quién>" --texto <fichero.md> [--tarea <id>]',
    'Los scripts de envío se niegan a funcionar contigo, así que no lo intentes: deja el borrador.',
    '',
    'PARA CONSULTAR DATOS: tienes DOS credenciales y sirven para cosas distintas.',
    '  · DATABASE_URL      → coordinación (claim, latido, preguntas). Solo esas 4 tablas.',
    '  · VENCE_LECTOR_URL  → LECTURA de negocio: preguntas, artículos, temario, alertas…',
    '    Solo SELECT, y sin datos personales (correo, nombre, pago): son UUIDs, no personas.',
    '    Si una consulta te da «permission denied» con la primera, prueba con la segunda antes',
    '    de darla por imposible — la primera tarea de la flota se quedó a medias por no saberlo.',
    '',
  'EL MÉTODO DE LA CASA — no es un consejo, es cómo se trabaja aquí:',
  ...METODO.map((l) => `  ${l}`),
]

// ── ¿ESTÁ LIBRE PARA RECIBIRLO? ─────────────────────────────────────────────────────────────
// «Libre» se decidía SOLO por el claim, y entre mandar el encargo y que el trabajador reclame la
// tarea pasan minutos: en esa ventana el trabajador es invisible y se le manda otro. Pasó el 05/08
// con `w1`, que recibió dos encargos seguidos — el segundo se tecleó dentro del proceso que ya
// estaba corriendo y se perdió, llevándose por delante la vuelta de reparto de esa tarea.
//
// La verdad la tiene la propia máquina: qué está ejecutando su panel. Es el mismo principio que
// `sesionViva` («se observa, no se declara») y no hace falta estado nuevo que mantener.
const SHELLS = ['bash', 'sh', 'zsh', 'fish', 'dash', 'ksh']

/**
 * @param paneCommand  lo que `tmux list-panes -F '#{pane_current_command}'` dice del trabajador
 * @returns {libre, motivo}
 *
 * Un shell = está esperando y se le puede mandar algo. Cualquier otra cosa = está trabajando.
 * Y **no saberlo NO es estar libre**: sin dato no se manda, que es el fail-closed de [T-539].
 */
function puedeRecibir(paneCommand) {
  const c = String(paneCommand || '').trim().replace(/^-/, '').toLowerCase()
  if (!c) return { libre: false, motivo: 'no se pudo ver qué está ejecutando su panel' }
  if (SHELLS.includes(c)) return { libre: true, motivo: null }
  return { libre: false, motivo: `ya está trabajando (su panel ejecuta "${c}")` }
}

/**
 * Lo que se le añade al encargo cuando RETOMA una tarea con el árbol a medias.
 *
 * Un turno de `claude -p` se acaba, y el que empieza no recuerda nada: sin esto, el trabajador
 * encuentra ficheros modificados que no sabe de dónde salen y lo normal es que empiece de cero
 * encima. Medido el 05/08 con `l1`: turno terminado a media tarea, **11 ficheros sin commitear y
 * ni un commit** — la única copia de ese trabajo.
 */
function avisoTrabajoAMedias(detalle) {
  return [
    '',
    '📌 ATENCIÓN — TU ÁRBOL TIENE TRABAJO A MEDIAS DE TU TURNO ANTERIOR:',
    `   ${detalle}`,
    '',
    'Eso lo hiciste tú y puede no estar en ningún otro sitio. ANTES DE NADA:',
    '  1. Míralo (git status, git diff) y entiende qué hay.',
    '  2. Ponlo a salvo con un commit en TU rama — aunque esté a medias, un commit se puede',
    '     rehacer y un fichero perdido no. Mensaje honesto: «wip(T-nnn): …».',
    '  3. SOLO ENTONCES sigue con la tarea.',
    'No empieces de cero encima ni descartes nada sin haberlo leído.',
  ].join('\n')
}

module.exports = { NO_APTAS, esApta, elegir, encargo, encargoImpugnacion, COLA_COMUN, puedeRecibir, SHELLS, avisoTrabajoAMedias }
