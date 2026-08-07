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
  // Solo para quien NO puede desplegar. Dejó de ser universal el 05/08, cuando los trabajadores
  // locales pasaron a cerrar el ciclo entero — y el filtro se quedó atrás, descartando **6 tareas
  // abiertas** que sí podían hacerse. Un filtro que sobrevive a la razón que lo justificaba es un
  // bloqueo sin motivo, y esos se descubren tarde porque no fallan: solo dejan de repartir.
  { patron: /\bdespleg|\bdeploy\b|rollout/i, soloSiNoDespliega: true,
    motivo: 'requiere desplegar, y esta máquina no puede (el candado del deploy es local — T-485)' },
  // `factur` a secas era demasiado ancho: en este repo **casi toda tarea valiosa justifica su
  // prioridad con lo que vende** («Aux. Admin. Madrid FACTURA 1.691 €/90d…»), y ahí el dinero es
  // CONTEXTO, no el asunto. Medido sobre las 253 abiertas: de las 10 que caían aquí, 9 eran de
  // dinero de verdad y una —[T-585], corpus documental— llevaba semanas saltándose sola en cada
  // ronda **sin que nadie lo supiera**. Se pide la forma sustantiva o el verbo en infinitivo.
  { patron: /stripe|cobro|pago|facturaci[oó]n|facturar|\bfacturas\b|suscripci|precio/i,
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
function esApta(tarea, { puedeDesplegar = false } = {}) {
  const t = String((tarea && tarea.title) || '')
  if (!t.trim()) return { apta: false, motivo: 'sin título: no se puede juzgar' }
  for (const r of NO_APTAS) {
    // Una regla marcada `soloSiNoDespliega` no aplica a quien SÍ puede: para él no hay nada que
    // impedir. Sin esto, el filtro sobrevive a la razón que lo justificaba.
    if (r.soloSiNoDespliega && puedeDesplegar) continue
    if (r.patron.test(t)) return { apta: false, motivo: r.motivo }
  }
  return { apta: true, motivo: null }
}

/** De una lista de candidatas, la primera apta. Devuelve también las descartadas y por qué. */
function elegir(tareas, opciones = {}) {
  const descartadas = []
  for (const t of tareas || []) {
    const v = esApta(t, opciones)
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
/**
 * REVISAR la entrega de OTRO trabajador. (T-486, 06/08/2026)
 *
 * ── EL ESCALÓN QUE NO TENÍA MOTOR ───────────────────────────────────────────────────────────
 * El ciclo de una tarea tiene seis escalones y cinco avanzan solos: el supervisor reparte, el
 * trabajador entrega, el deploy despierta a las que esperaban, el reloj suelta a las dormidas.
 * `entregada → revisada` esperaba a que **alguien decidiera mirar**, y eso no ocurre solo.
 * Medido el 06/08: **23 entregas paradas, 15 h de media, la más vieja 41 h**. No era una cola
 * lenta: era una cola sin salida.
 *
 * ── POR QUÉ UN ENCARGO DISTINTO Y NO «que la coja otro» ─────────────────────────────────────
 * `claim` se NIEGA a entregar una tarea en revisión, y hace bien: el encargo normal dice «haz
 * esta tarea», así que el siguiente la REHARÍA desde cero en vez de revisarla. Es exactamente lo
 * que pasó con las impugnaciones — cinco borradores del mismo caso porque la cola las reofrecía.
 * Lo que faltaba no era quitar el bloqueo, era un encargo que dijera otra cosa.
 *
 * ── LO QUE ESTE ENCARGO **NO** DELEGA ───────────────────────────────────────────────────────
 * Meterlo en `main`. Al juntar ramas aparecen choques que ninguna ve por separado: el 06/08, al
 * mergear tres, salieron un guardarraíl de paridad roto, una colisión de migraciones con el mismo
 * nombre y tres arreglos hechos por duplicado. Eso lo decide una persona. El revisor deja el
 * veredicto, y con él la decisión de mergear pasa a ser barata.
 */
function encargoRevision({ trabajador, tarea, entrega = null, autor = null }) {
  return [
    `Eres ${trabajador}, un TRABAJADOR de la flota de Vence. Trabajas solo, sin nadie mirando.`,
    '',
    'Tu encargo NO es hacer una tarea: es **REVISAR lo que ya entregó otro trabajador**.',
    '',
    `   tarea:  ${tarea.id} — ${tarea.title}`,
    autor ? `   la entregó: ${autor}` : '',
    entrega ? `   dice haber hecho:\n     ${String(entrega).replace(/\n/g, '\n     ').slice(0, 900)}` : '',
    '',
    '⚠️ NO LA REHAGAS. Ya está hecha. Si te pones a reescribirla habrás gastado el turno en',
    '   duplicar trabajo, que es justo lo que esto viene a evitar.',
    '',
    'REVISAR ES TRES COSAS, en este orden:',
    '  1. LEE EL DIFF de su rama contra `origin/main`. ¿Hace lo que dice que hace?',
    '  2. COMPRUEBA SU AFIRMACIÓN CONTRA LA REALIDAD. Si dice «la causa es X», reprodúcelo o',
    '     mídelo tú: consulta la BD, ejecuta el comando, mira el fichero. **Una entrega que',
    '     afirma una causa sin demostrarla es un hallazgo de revisión**, no un detalle.',
    '  3. CORRE SUS TESTS, y los del área que toca. Que pasen los suyos no basta si rompe otros.',
    '',
    'Y UNA CUARTA que se olvida: **¿le falta alguna capa?** Si toca código de producción sin',
    'test, guardarraíl ni simulación, eso es un hallazgo aunque el código esté bien.',
    '',
    // ── EL MÉTODO ES LA VARA DE MEDIR DE UNA REVISIÓN (T-495 / 07/08) ──────────────────────
    // El encargo de TRABAJAR lo traía y el de REVISAR no: 8.920 caracteres contra 1.897, medido
    // en los encargos vivos del VPS. Y aquí importa MÁS, no menos — es el criterio contra el que
    // se juzga una entrega. Un revisor sin él aprueba lo que un trabajador CON él no habría
    // escrito, y entonces el método solo aplica en la mitad del ciclo.
    'Y JUZGA CONTRA EL MÉTODO DE LA CASA, que es el mismo con el que se le pidió el trabajo:',
    ...METODO.map((l) => `  ${l}`),
    '',
    'No es una lista de buenos deseos: cada punto es un hallazgo si falta. «Ya existía» y «esto es',
    'un silo» son los dos que más caros salen, porque el código funciona igual y nadie los ve',
    'hasta que hay dos herramientas haciendo lo mismo con criterios distintos.',
    '',
    'CUANDO TERMINES, el veredicto — es OBLIGATORIO y solo hay dos:',
    '  · Todo correcto:',
    `      node scripts/backlog.cjs revisado ${tarea.id} --veredicto ok \\`,
    '        --hallazgos "qué leíste, qué comprobaste y CÓMO (el comando, la cifra, la consulta)"',
    '  · Hay algo que arreglar:',
    `      node scripts/backlog.cjs revisado ${tarea.id} --veredicto problemas \\`,
    '        --hallazgos "qué falla, DÓNDE, y qué habría que hacer para arreglarlo"',
    '',
    'El «ok» tiene que decir QUÉ comprobaste, no que lo comprobaste. «Revisado y correcto» no es',
    'un veredicto, es un sello: quien lo lea después no sabrá si miraste el diff o el título.',
    '',
    'NO la mergees a `main` ni la cierres: eso lo decide una persona. Tu veredicto es lo que hace',
    'que esa decisión sea barata.',
    '',
    'Para poder trabajarla te hará falta cogerla, y `claim` te dirá que está entregada. Es lo',
    'esperado — dile que vas a REVISARLA:',
    `   node scripts/backlog.cjs claim ${tarea.id} --force --motivo "reviso la entrega de ${autor || 'otro trabajador'}"`,
    '',
  ].filter((l) => l !== '').join('\n')
}

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
    '  · NO AFIRMES UNA CAUSA QUE NO HAYAS DEMOSTRADO. Escribir «causa raíz encontrada» hace que',
    '    quien revise se lo crea y mergee sin volver a mirarlo. Solo vale si puedes hacer UNA de',
    '    estas dos cosas, y la escribes en la entrega:',
    '      (a) REPRODUCIRLA: la provocas a propósito y el fallo aparece; la quitas y desaparece.',
    '      (b) MEDIRLA sobre datos reales, con la CIFRA dentro («este worker estaba 127 commits',
    '          por detrás», no «el clon estaba desactualizado»).',
    '    Si no puedes ninguna, escribe «SOSPECHO que…» y di qué falta para confirmarlo. Una',
    '    sospecha vestida de certeza es PEOR que no haber mirado: manda a quien venga detrás en la',
    '    dirección equivocada, y con confianza.',
    '',
    'LLEVA LA TAREA HASTA EL FINAL. No entregues a medias lo que puedes terminar tú:',
    '  1. Hazla. Con sus capas (test / guardarraíl / simulación) — el pre-push las exige.',
    '  2. EMPUJA TU RAMA. No al final: en cuanto tengas algo que valga la pena conservar.',
    '       git add -A && git commit -m "…" && git push origin HEAD',
    '     Lo que solo existe en el disco de esta máquina NO EXISTE. El 05/08 hubo que rescatar',
    '     a mano 22 commits atrapados aquí, tres veces en el mismo día: trabajo terminado y',
    '     verificado que nadie podía ver porque el turno murió antes de empujarlo.',
    '     A `main` NO empujas tú (regla de arriba): entregas la rama y alguien la revisa.',
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
    'TU TURNO NO TERMINA SIN CERRAR. Antes de escribir tu última frase, DOS comandos:',
    '  (a) `git push origin HEAD`  — aunque creas que ya lo hiciste. Compruébalo:',
    '        git status --porcelain    # vacío',
    '        git rev-list --count HEAD --not --remotes    # 0',
    '  (b) uno de los cierres de abajo. Una tarea que se queda `in_progress` sin proceso está',
    '      COGIDA POR NADIE: bloquea al resto y no avanza. Es el peor estado posible, peor que',
    '      soltarla. El 05/08 pasó cuatro veces en una tarde.',
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
    '── ENCADENA MIENTRAS TE QUEDE CONTEXTO: NO TERMINES EL TURNO CON SITIO LIBRE ──',
    'Al cerrar tu tarea, si NO has llegado al 80% de contexto, COGE OTRA y sigue en este mismo',
    'turno. Y cógela RELACIONADA: al cerrar, el CLI te sugiere primero las que cita tu propia',
    'ficha — ésas cuestan la mitad, porque acabas de leerte ese subsistema. Solo si no hay',
    'ninguna libre, la que te proponga `next`:',
    '     node scripts/backlog.cjs done <id> --outcome "…"   # te sugiere las relacionadas',
    '     node scripts/backlog.cjs claim <id>                # imprime su ficha entera',
    'Y repite hasta llegar al 80%; entonces cierra y termina.',
    '',
    'RENUEVA EL LEASE MIENTRAS ENCADENAS:  node scripts/backlog.cjs heartbeat',
    'El claim caduca a los 90 min. Un turno largo sin renovarlo deja tu tarea libre para otro',
    'trabajador mientras TÚ sigues escribiendo en ella — dos haciendo lo mismo sin saberlo. Y de',
    'paso `heartbeat` te reimprime el método, que a media tarea es justo cuando se olvida.',
    '',
    'Por qué importa, medido el 06/08: los cuatro trabajadores acababan su tarea, terminaban el',
    'turno y se quedaban PARADOS hasta que el supervisor volviera a repartir — media hora de',
    'máquina encendida sin hacer nada, y cada turno nuevo arranca de cero: vuelve a leer el',
    'manual, a orientarse en el repo, a entender el andamiaje. Ese arranque ya lo has pagado.',
    'Encadenar aprovecha lo que YA sabes; parar lo tira y obliga a comprarlo otra vez.',
    '',
    'No contradice la regla del 80%: encadenar es DENTRO de tu turno y en primer plano. El',
    'límite sigue siendo el contexto, no la tarea. Y sigue valiendo lo de siempre: cada tarea se',
    'reclama ANTES de trabajarla, y se cierra con su verbo antes de coger la siguiente — dos',
    'tareas cogidas a la vez le quitan trabajo al resto de la flota.',
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
 * ¿El encargo que se acaba de mandar SIGUE vivo, o murió al instante? (T-642)
 *
 * `tmux send-keys` solo confirma que las teclas se ESCRIBIERON en el panel — no que el comando
 * arrancara ni que siguiera vivo. Medido el 07/08: con la cuota semanal agotada, `claude -p`
 * muere en menos de un segundo, y sin esta comprobación el supervisor lo contaba como
 * `{ok:true}` cada 5 minutos durante 3 horas mientras dos trabajadores no hacían nada.
 *
 * Se pregunta lo mismo que `puedeRecibir` pero con la pregunta al revés: si tras esperar un
 * margen el panel VOLVIÓ a un shell, el encargo NO arrancó de verdad. Es deliberadamente el
 * mismo criterio (un panel solo puede estar en uno de los dos estados) — dos preguntas con
 * nombres distintos para dos momentos distintos, no dos criterios.
 *
 * @param paneCommandTrasEsperar  lo que dice el panel DESPUÉS de un margen de espera corto,
 *                                 no inmediatamente tras el `send-keys`
 * @returns {arranco, motivo}  `arranco:false` con motivo cuando volvió a un shell;
 *                              `arranco:null` (no `false`) cuando no se pudo ver el panel —
 *                              fail-closed hacia «no se sabe», no hacia «murió», porque un panel
 *                              que no se puede leer no es lo mismo que uno que sí se leyó y
 *                              volvió a un shell.
 */
function arrancoDeVerdad(paneCommandTrasEsperar) {
  const v = puedeRecibir(paneCommandTrasEsperar)
  if (v.libre) return { arranco: false, motivo: 'el turno terminó casi al instante (su panel ya está en un shell de nuevo)' }
  if (v.motivo && v.motivo.includes('no se pudo ver')) return { arranco: null, motivo: v.motivo }
  return { arranco: true, motivo: null }
}

// ── ¿ESTÁ EL TRABAJADOR EN PIE? ─────────────────────────────────────────────────────────────
// `puedeRecibir` y `arrancoDeVerdad` responden por el PANEL, y las dos dan por hecho que el panel
// EXISTE. El 07/08 se midió el hueco que dejaba esa suposición: las sesiones de tmux de `w2` y `w4`
// desaparecieron, y como el bucle hace `if (!sesionViva(w)) continue` **sin decir nada**, el
// supervisor imprimió «todo en marcha, nada que repartir» durante una hora con dos de tres
// trabajadores muertos. No es que fallara la comprobación: es que su respuesta no llegaba a nadie.
//
// Y el `arrancar` que debía resucitarlos **tampoco podía**: la unidad de systemd es de un solo
// disparo (`active (exited)`), así que `systemctl start` sobre ella **no hace nada** y el comando
// imprimía `✅ arrancado` igual. Tres piezas del mismo fallo — se DECLARA en vez de OBSERVARSE.
//
// Esta función responde a la vez a «¿en qué estado está?» y «¿hay que hacer algo?», porque
// separarlas es lo que permitió que un estado (sin sesión) no tuviera acción asociada.

/**
 * @param {boolean|null} sesionExiste  ¿tiene sesión de tmux? `null` = no se pudo comprobar
 * @param {string} paneCommand         lo que ejecuta su panel (`''` si no se pudo leer)
 * @param {boolean} reparte            ¿su máquina entra en el reparto automático?
 * @returns {{estado, libre, motivo, accion}}
 *   · `apagado`     — sin sesión y su máquina NO reparte: es el portátil de Manuel, está bien así
 *   · `sin_sesion`  — sin sesión y DEBERÍA tenerla → `accion:'resucitar'`
 *   · `invisible`   — no se pudo mirar; no se actúa a ciegas, pero se DICE
 *   · `libre`       — panel en un shell, listo para recibir
 *   · `trabajando`  — panel ejecutando algo
 *
 * Distinguir `apagado` de `sin_sesion` no es cosmética: hasta el 07/08 los seis trabajadores del
 * portátil salían 🔴 «hace 2.132 min» de forma permanente, y seis líneas rojas fijas en cabecera
 * enseñan a no mirar el rojo — el día que cae uno que SÍ debería estar corriendo, su línea es la
 * séptima igual. Es la misma lección que «un cron apagado no es un cron averiado».
 */
function presenciaDelPanel({ sesionExiste = null, paneCommand = '', reparte = true, turnosVivos = 0 } = {}) {
  // ── UN TURNO HUÉRFANO SIGUE SIENDO UN TURNO (T-642, 07/08, segunda tanda) ────────────────
  // Cuando el OOM del VPS se lleva por delante el servidor de tmux, el `claude -p` que corría
  // dentro **NO muere: queda huérfano y sigue trabajando**. Su sesión ya no aparece, así que la
  // reanimación creaba una NUEVA y el reparto le mandaba un SEGUNDO turno — medido dos veces esa
  // mañana: los cuatro trabajadores con dos `claude -p` a la vez sobre el mismo árbol, uno de
  // 616 s y otro de 395 s. Dos turnos en el mismo worktree se pisan los ficheros y el git.
  //
  // Por eso el proceso manda sobre el panel: el panel dice dónde está la sesión, el proceso dice
  // si alguien está TRABAJANDO. Cuando discrepan, gana el que puede destruir trabajo.
  if (turnosVivos > 0) {
    return {
      estado: 'trabajando',
      libre: false,
      motivo: `ya tiene ${turnosVivos} turno(s) vivo(s)${sesionExiste === false ? ' (huérfano: su sesión murió y el proceso siguió)' : ''}`,
      accion: null,
    }
  }
  if (sesionExiste === false) {
    return reparte
      ? { estado: 'sin_sesion', libre: false, motivo: 'no tiene sesión de tmux y debería tenerla', accion: 'resucitar' }
      : { estado: 'apagado', libre: false, motivo: 'apagado (su máquina no entra en el reparto)', accion: null }
  }
  if (sesionExiste === null) {
    return { estado: 'invisible', libre: false, motivo: 'no se pudo comprobar si tiene sesión', accion: null }
  }
  const v = puedeRecibir(paneCommand)
  if (v.libre) return { estado: 'libre', libre: true, motivo: null, accion: null }
  if (v.motivo && v.motivo.includes('no se pudo ver')) {
    return { estado: 'invisible', libre: false, motivo: v.motivo, accion: null }
  }
  return { estado: 'trabajando', libre: false, motivo: v.motivo, accion: null }
}

/**
 * El comando que levanta a un trabajador, y que tiene que funcionar TAMBIÉN cuando ya estaba
 * arrancado. (T-642, 07/08)
 *
 * En el VPS la unidad es de un solo disparo con `RemainAfterExit`, así que una vez ejecutada se
 * queda `active (exited)` **para siempre** — aunque su tmux haya desaparecido. Sobre eso,
 * `systemctl start` es un no-op silencioso: exactamente lo que pasó con `w2` y `w4`, que se
 * dieron por arrancados sin que volviera ninguna sesión. `restart` sí vuelve a ejecutarla, y es
 * idempotente para el caso sano.
 *
 * En el portátil no hay unidad: la sesión es de la persona, así que se crea si no está.
 */
function ordenDeArranque({ trabajador, systemd = false } = {}) {
  const w = String(trabajador || '')
  // ⚠️ LA CONDICIÓN ES «¿HAY UNIDAD?», NO «¿ES LOCAL?» (T-642/T-647, 07/08). Se decidía por
  // local/remoto, y en el VPS —donde el supervisor vive en la MISMA máquina que sus
  // trabajadores— eso caía en la rama de tmux: el supervisor levantaba las sesiones él mismo, el
  // servidor de tmux colgaba de SU cgroup y todos los `claude -p` se contabilizaban contra él.
  // Medido: un turno se desbocó a 6,6 GB y el kernel mató al SUPERVISOR, porque era quien
  // «gastaba» esa memoria; y cualquier límite puesto en `vence-flota@w1` no habría acotado nada,
  // porque ahí dentro no había nadie. Levantarlos por systemd es lo que pone a cada trabajador
  // en su propio cgroup, y sin eso no se le puede poner techo a ninguno.
  //
  // `restart` y no `start`: la unidad es de un solo disparo con `RemainAfterExit`, así que una
  // vez ejecutada `start` es un no-op silencioso aunque su tmux haya desaparecido.
  return systemd
    ? `systemctl restart vence-flota@${w}`
    : `tmux -L ${w} has-session -t ${w} 2>/dev/null || tmux -L ${w} new-session -d -s ${w} -c "$HOME/vence-sessions/${w}" /bin/bash`
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


/**
 * ¿Le toca a la flota la cola de IMPUGNACIONES?
 *
 * Desde el 05/08/2026, NO. Decisión de Manuel tras revisar la primera tanda, y el motivo no es que
 * analicen mal —la que se verificó a fondo la acertaron, y tres por separado— sino DÓNDE cuesta el
 * error: una impugnación acaba en un correo a una persona, y el criterio que evita el fallo (la
 * trampa de las páginas traducidas, la prueba discriminante de localización) todavía no está en el
 * repo. En el backlog un error es un commit malo que la revisión caza.
 *
 * ── POR QUÉ ES UNA FUNCIÓN Y NO UN `if` EN CADA SITIO ────────────────────────────────────────
 * Hay DOS puertas de reparto (`repartir` y `vigilar`) y el 05/08 se cambió solo una: `vigilar`
 * dejó de dar impugnaciones y `repartir` siguió dándolas, así que el trabajo dependía de por dónde
 * entrases — exactamente lo que el comentario de esa función advertía que no podía pasar. El test
 * que debía cazarlo miraba si la variable APARECÍA en el fichero, y aparecía: una sola puerta
 * arreglada bastaba para pasarlo.
 */
function flotaCogeImpugnaciones() {
  return process.env.VENCE_FLOTA_IMPUGNACIONES === '1'
}

module.exports = { NO_APTAS, flotaCogeImpugnaciones, encargoRevision, esApta, elegir, encargo, encargoImpugnacion, COLA_COMUN, puedeRecibir, arrancoDeVerdad, presenciaDelPanel, ordenDeArranque, SHELLS, avisoTrabajoAMedias }
