#!/usr/bin/env node
/**
 * flota.cjs — gobernar la flota desde el portátil, sin entrar en ningún servidor. (T-486)
 *
 * ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
 * Los trabajadores ya se sincronizan solos con las sesiones locales (claim, latido, embudo,
 * entregas viven en RDS). Lo que faltaba era lo de arriba: **arrancarlos, darles trabajo y saber
 * cómo van sin abrir una terminal por máquina**. Sin esto, «tengo una flota» significa en la
 * práctica «tengo que entrar por SSH a cada sitio», que es exactamente lo que se quería evitar.
 *
 * Se apoya en lo que ya hay y no duplica nada:
 *   · quién está vivo  → `worktree_sessions` (lo escribe el latido, escritor único)
 *   · qué hace cada uno → `backlog_tasks` (el claim)
 *   · qué te pregunta   → `session_questions` (el embudo de T-493)
 *   · qué te entrega    → la quinta espera de T-539
 * Lo único propio es el cruce con lo ESPERADO (`lib/flota/maquinas.cjs`), que es lo que permite
 * decir «falta w2» en vez de enseñar solo lo que hay.
 *
 * Uso:
 *   npm run flota                       # estado: quién vive, qué hace, qué falta
 *   npm run flota -- encargar w1        # le manda su encargo (elige tarea apta si no se dice)
 *   npm run flota -- encargar w1 --tarea T-451
 *   npm run flota -- arrancar w2        # levantar uno parado
 *   npm run flota -- parar w2
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const REPO = path.resolve(__dirname, '..', '..')
const MAQ = require(path.join(REPO, 'lib', 'flota', 'maquinas.cjs'))
const ENC = require(path.join(REPO, 'lib', 'flota', 'encargo.cjs'))
const { sidCorto } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'))
const AUT = require(path.join(REPO, 'lib', 'flota', 'autenticacion.cjs'))
const ACTU = require(path.join(REPO, 'lib', 'flota', 'actualizacion.cjs'))
const RESC = require(path.join(REPO, 'lib', 'flota', 'rescate.cjs'))
// El cruce tarea↔señal ya lo resuelve el parte: se REUSA, no se copia (T-130).
const PARTE = require(path.join(REPO, 'lib', 'sessions', 'parte.cjs'))
const PROD = require(path.join(REPO, 'lib', 'sessions', 'productividad.cjs'))
// Quién espera revisor y quién espera decisión lo decide UN sitio (T-486): si el supervisor lo
// dedujera por su cuenta de las columnas, `flota` y `backlog list` acabarían contando distinto.
const REV = require(path.join(REPO, 'lib', 'backlog', 'revision.cjs'))

const cmd = process.argv[2] || 'estado'
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try { return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim() } catch { return null }
}

/**
 * Ejecuta algo en la máquina de un trabajador. Sin secretos en la línea de órdenes.
 *
 * El portátil es una máquina más (`local: true`): se ejecuta aquí mismo, sin SSH. Es lo que
 * permite que el supervisor sea UN solo punto de entrada para todo — que es lo que quita las
 * pantallas múltiples. El resto del código no distingue: pide «haz esto en la máquina de w1» y ya.
 */
function enMaquina(trabajador, orden, { entrada = null } = {}) {
  const m = MAQ.maquinaDe(trabajador)
  if (!m) throw new Error(`el trabajador "${trabajador}" no está declarado en ninguna máquina (lib/flota/maquinas.cjs)`)
  const opciones = { encoding: 'utf8', input: entrada || undefined, timeout: 120_000 }
  if (m.local) return execFileSync('bash', ['-c', orden], opciones)
  return execFileSync('ssh', ['-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=10',
    '-i', m.llave, `${m.usuario}@${m.host}`, orden], opciones)
}

/**
 * ¿Está viva la SESIÓN de un trabajador, aunque no esté latiendo?
 *
 * El latido va dentro de los comandos del andamiaje, así que un trabajador ENTRE TAREAS no late —
 * y a los 15 minutos el panel lo daba por caído estando perfectamente. «Libre» y «muerto» piden
 * cosas opuestas: al primero se le manda trabajo, al segundo se le levanta.
 *
 * La sesión de tmux es la verdad: si existe, hay a quién mandarle un encargo.
 */
function sesionViva(trabajador) {
  const m = MAQ.maquinaDe(trabajador)
  const como = m && m.local ? '' : 'sudo -u flota '
  try {
    enMaquina(trabajador, `${como}tmux has-session -t ${trabajador} 2>/dev/null`)
    return true
  } catch { return false }
}

/** Qué está ejecutando el panel de un trabajador. Cadena vacía si no se puede ver (≠ «nada»). */
function comandoDelPanel(trabajador) {
  const m = MAQ.maquinaDe(trabajador)
  const como = m && m.local ? '' : 'sudo -u flota '
  try {
    return enMaquina(trabajador,
      `${como}tmux list-panes -t ${trabajador} -F '#{pane_current_command}' 2>/dev/null | head -1`).trim()
  } catch { return '' }
}

/**
 * Envuelve un script para que el shell de la máquina lo pase INTACTO a `bash -c`.
 *
 * Con comillas dobles (`JSON.stringify`) el shell de fuera expande los `$(…)` ANTES de que el
 * script llegue a su sitio: la sonda del clon acabó ejecutando `git rev-parse` en el directorio
 * equivocado y reportando «no hay repo» de una máquina que lo tenía (05/08). En comillas simples
 * no se expande nada.
 */
const citar = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`

/**
 * Deja el clon del trabajador al día ANTES de darle trabajo. Si no puede, NO se le da. (T-486)
 *
 * ── POR QUÉ ES UNA PUERTA Y NO UN AVISO ─────────────────────────────────────────────────────
 * Un clon viejo no es «una versión anterior»: trae **los guardarraíles de su fecha**, que son lo
 * único que hace segura a la flota. Medido el 05/08 — `w1` llevaba 30 commits de retraso, así que
 * no tenía el canario con el que habría comprobado su propio permiso, ni el comando `revision` que
 * su situación pedía, y se quedó una hora parado preguntando algo que su repo ya sabía responder.
 *
 * Falla CERRADO, como manda [T-539] para un autónomo: si no se puede comprobar, no se encarga.
 * Y nunca a la brava — un clon con cambios sin commitear puede ser el único rastro de un trabajo
 * ([T-431]): se rehúsa y se dice qué hay, que tirarlo lo decide una persona.
 */
function ponerAlDia(trabajador, { emitir = null, reanuda = false } = {}) {
  const como = MAQ.maquinaDe(trabajador)?.local ? '' : 'sudo -u flota '
  const arbol = MAQ.arbolDe(trabajador)
  let salida = ''
  try {
    salida = enMaquina(trabajador, `${como}bash -lc ${citar(ACTU.SONDA_GIT(arbol))}`)
  } catch (e) { salida = String((e && e.stdout) || '') }
  const v = ACTU.evaluarClon(ACTU.leerSonda(salida), { reanuda })

  let commits = null
  if (v.hayQueActualizar) {
    try {
      const orden = v.volverAMain ? ACTU.ORDEN_A_MAIN(arbol, trabajador) : ACTU.ORDEN_ACTUALIZAR(arbol)
      commits = `ahora en ${enMaquina(trabajador, `${como}bash -lc ${citar(orden)}`).trim()}`
    } catch (e) {
      // Se creía que se podía avanzar y el pull falló: eso ya no es «atrasado», es no saber.
      const fallo = { estado: 'sin_red', puedeEncargar: false, hayQueActualizar: false,
        motivo: `el pull falló: ${String((e && e.message) || e).slice(0, 120)}` }
      if (emitir) emitir(fallo)
      return { ...fallo, linea: ACTU.diagnostico(trabajador, fallo) }
    }
  }
  if (emitir) emitir(v)
  return { ...v, linea: ACTU.diagnostico(trabajador, v, { commits }) }
}

/**
 * Manda un encargo a un trabajador. **Única puerta**: `encargar` y `repartir` pasan por aquí.
 *
 * Estaba escrito dos veces —una por comando— y así es como una de las dos se queda sin el
 * guardarraíl que se añade a la otra ([T-130]). El paso por el clon al día va DENTRO, no en cada
 * llamador, por el mismo motivo: un guardarraíl que hay que acordarse de invocar no es un
 * guardarraíl (§8, «impedir en el punto de escritura»).
 *
 * El encargo va a un FICHERO en la máquina y se lanza con `claude -p "$(cat …)"`.
 *
 * Por qué no al TUI interactivo: `CLAUDE_CODE_OAUTH_TOKEN` autentica `claude -p` pero el TUI lo
 * IGNORA y se queda en la pantalla de login (medido el 05/08 con un token válido). Y por qué por
 * fichero y no como argumento: el encargo es multilínea y acabaría roto por las comillas, además
 * de quedar visible en `ps` para cualquier usuario de la máquina.
 *
 * ── POR QUÉ `bypassPermissions` Y POR QUÉ ES DEFENDIBLE AQUÍ ────────────────────────────────
 * Un trabajador autónomo no tiene a quién pedirle permiso: con el modo por defecto se queda
 * preguntando «¿puedo ejecutar claim?» a una terminal que nadie mira, que es como pasó la primera
 * vez. La contención NO es el diálogo de permisos, son las credenciales: esta máquina tiene el rol
 * `vence_coordinacion` (4 tablas, ninguna de negocio, ningún DELETE) y el de lectura (sin
 * identificadores directos, sin escritura), no tiene claves de AWS ni de Stripe, y no puede
 * desplegar.
 *
 * ⚠️ Riesgo residual conocido y NO cerrado: el clon del repo tiene escritura sobre `main`. Mientras
 * eso siga así, lo que impide un push indebido es el push-guard y el encargo, no el permiso.
 *
 * Todo se hace COMO el usuario del trabajador: su tmux, su fichero de encargo, su log. Claude Code
 * se niega a trabajar sin supervisión con privilegios de root (y hace bien). En el portátil ya
 * eres tú: ni sudo ni chown.
 */
function mandarEncargo(trabajador, texto, { alDia = null, turno = null } = {}) {
  // ¿Está libre AHORA? El claim tarda minutos en aparecer desde que se manda el encargo, y en esa
  // ventana el trabajador es invisible para el reparto. La verdad la tiene su panel.
  const ocupacion = ENC.puedeRecibir(comandoDelPanel(trabajador))
  if (!ocupacion.libre) return { ok: false, ocupado: true, motivo: ocupacion.motivo }

  const al = alDia || ponerAlDia(trabajador)
  if (al.linea) console.log(`   ${al.linea}`)
  if (!al.puedeEncargar) return { ok: false, al }
  // Un turno nuevo no recuerda nada del anterior: si dejó trabajo a medias hay que DECÍRSELO,
  // o lo normal es que empiece de cero encima de la única copia que existe.
  if (al.estado === 'a_medias') texto += '\n' + ENC.avisoTrabajoAMedias(al.motivo)

  const m = MAQ.maquinaDe(trabajador)
  const env = ficheroEntorno(trabajador)
  const enc = env.replace(/\.env$/, '.encargo')
  const como = m.local ? '' : 'sudo -u flota '
  const dueno = m.local ? '' : `&& chown flota ${enc} `
  enMaquina(trabajador,
    `umask 077 && mkdir -p "$(dirname ${enc})" && cat > ${enc} ${dueno}&& ` +
    `${como}tmux send-keys -t ${trabajador} 'set -a; . ${env}; set +a; ` +
    `"\${CLAUDE_BIN:-claude}" -p "$(cat ${enc})" --permission-mode bypassPermissions 2>&1 | tee -a ~/flota-${trabajador}.log' Enter`,
    { entrada: texto })
  // El rastro lo deja la PUERTA, no el llamador. Puesto en cada sitio que manda, se olvida en uno
  // — y de hecho se olvidó en `repartir` al primer intento, así que la serie nacía incompleta.
  if (turno) turno()
  return { ok: true, al }
}

/** Dónde vive el fichero de entorno de un trabajador, que en local no está en /etc. */
function ficheroEntorno(trabajador) {
  const m = MAQ.maquinaDe(trabajador)
  return m && m.local
    ? `${process.env.HOME}/.vence-flota/${trabajador}.env`
    : `/etc/vence-flota/${trabajador}.env`
}

async function main() {
  const u = url()
  if (!u) { console.error('❌ sin DATABASE_URL'); return 1 }
  const sql = require('postgres')(u, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 15 })

  // Al bus, para que la serie EXISTA: cada cuánto se queda atrás la flota y cuántas veces no se le
  // puede dar trabajo. Sin esto, «el clon estaba viejo» solo se sabe cuando alguien lo mira.
  // Fail-open a propósito (§9): la telemetría no puede impedir gobernar la flota.
  const emitirClon = (trabajador, v) => sql`
    INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
    VALUES ('fargate', ${ACTU.severidad(v)}, 'flota_clon_desactualizado', 'flota', ${v.motivo},
            ${sql.json({ trabajador, maquina: MAQ.maquinaDe(trabajador)?.nombre || null, estado: v.estado })})`
    .catch(() => {})


  // ── EL TURNO DE UN TRABAJADOR, VISIBLE ────────────────────────────────────────────────────
  // Hasta aquí se observaba el ANDAMIAJE (preflight, fricción, clon al día) pero no el trabajo: el
  // turno de un `claude -p` nacía y moría dentro de un fichero de log en su máquina, sin cruzar a
  // ninguna parte. Nadie podía responder «¿cuánto tarda un turno?», «¿cuántos mueren a medias?»
  // ni «¿qué se le encargó y cuándo?» sin entrar por SSH a leer un `tail`.
  //
  // Un solo `event_type` con `fase` dentro, y no dos: dos tipos para el mismo hecho se vigilan con
  // dos reglas y una acaba sin nadie que la mire.
  const emitirTurno = (trabajador, fase, extra = {}) => sql`
    INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
    VALUES ('fargate', ${fase === 'muerto' ? 'warn' : 'info'}, 'flota_turno', 'flota',
            ${extra.motivo || null},
            ${sql.json({ trabajador, fase, maquina: MAQ.maquinaDe(trabajador)?.nombre || null, ...extra })})`
    .catch(() => {})

  try {
    if (cmd === 'estado') {
      // TODAS las sesiones, no solo los trabajadores: el supervisor tiene que enseñar en UNA
      // pantalla lo que está pasando, y las sesiones que abre Manuel a mano son la mitad de eso.
      // Se ven pero no se gobiernan: a la terminal de una persona no se le mandan encargos.
      const todas = await sql`
        SELECT sid, slug, host, rol, last_signal_at, last_command FROM public.worktree_sessions`
      const sesiones = todas.filter((s) => s.rol === 'trabajador')
      const tareas = await sql`
        SELECT id, title, claimed_by FROM public.backlog_tasks
         WHERE status = 'in_progress' AND claimed_by IS NOT NULL`
      // Se traen las columnas del veredicto porque hay DOS estados distintos aquí (T-486): sin
      // mirar todavía, y ya mirada con veredicto escrito. Colapsarlas anunciaba «19 esperando que
      // las revises» cuando 4 ya estaban revisadas — y el resultado de esa revisión no lo veía
      // nadie. El criterio no se re-escribe aquí: lo pone `lib/backlog/revision.cjs`.
      const entregas = await sql`
        SELECT id, title, review_requested_at, review_requested_by,
               reviewed_at, reviewed_by, review_verdict, review_findings
          FROM public.backlog_tasks
         WHERE review_requested_at IS NOT NULL AND status <> 'done'`
      const preguntas = await sql`
        SELECT id, sid, question, kind, draft_target FROM public.session_questions WHERE status = 'open'
         ORDER BY (kind = 'borrador') DESC, asked_at`.catch(() => [])

      const filas = MAQ.comparar(sesiones)
      const porSid = new Map(sesiones.map((s) => [s.slug, s.sid]))
      const tareaDe = (slug) => tareas.find((t) => t.claimed_by === porSid.get(slug))

      console.log('\nFLOTA')
      console.log('='.repeat(60))
      // ── LA PREGUNTA QUE EL LATIDO NO CONTESTA: ¿HAY ALGUIEN EJECUTANDO? ─────────────
      // El latido demuestra que un comando del andamiaje corrió; el claim, que alguien cogió la
      // tarea. Ninguno de los dos dice si AHORA MISMO hay un proceso trabajando. Medido el 05/08:
      // el panel decía «✅ toda la flota viva y trabajando» con los cuatro 🟢 y sus tareas… y el
      // VPS estaba a **carga 0,05 con CERO procesos de Claude**. Los turnos habían terminado
      // solos y las tareas se quedaron cogidas por nadie.
      //
      // Un trabajador con tarea cogida y sin proceso es el estado PEOR de todos: bloquea la tarea
      // para los demás y no avanza. Se pinta aparte porque se arregla distinto — no hay que
      // levantarlo (su tmux vive), hay que volver a lanzarle el turno.
      const abandonadas = []
      for (const f of filas) {
        // ⚠️ «No se pudo ver» NO es «está ejecutando». `comandoDelPanel` devuelve cadena vacía
        // cuando no hay sesión de tmux —o no se puede alcanzar la máquina—, y leer eso como
        // «ocupado» pintaba de verde a un trabajador que NO EXISTE: pasó con w3 y w4 el 05/08,
        // declarados en el registro y nunca arrancados, saliendo «🟢 ejecutando». Es el mismo
        // verde falso que este repo persigue en el contenido, aquí en el panel que lo vigila.
        const comando = comandoDelPanel(f.trabajador)
        const ejecutando = comando !== '' && ENC.puedeRecibir(comando).libre === false
        // Un trabajador callado PERO con sesión viva está LIBRE, no caído. Confundirlos manda a
        // levantar lo que solo hacía falta encargar.
        const libre = !ejecutando && sesionViva(f.trabajador)
        const t = tareaDe(f.trabajador)
        const abandonada = !!t && !ejecutando
        if (abandonada) abandonadas.push({ trabajador: f.trabajador, tarea: t })
        const icono = abandonada ? '🟠' : ejecutando ? '🟢' : libre ? '🔵' : '🔴'
        const cuando = f.antiguedadMin == null ? 'sin señal nunca'
          : f.antiguedadMin < 1 ? 'ahora mismo' : `hace ${f.antiguedadMin} min`
        console.log(`  ${icono} ${f.trabajador.padEnd(4)} ${f.maquina.padEnd(9)} ${cuando}${ejecutando ? '  · ejecutando' : ''}`)
        console.log(`       ${abandonada ? `⚠️ ${t.id} COGIDA Y SIN PROCESO — su turno terminó (relánzalo: flota -- encargar ${f.trabajador} --tarea ${t.id})`
          : t ? `${t.id} — ${String(t.title).slice(0, 60)}`
          : libre ? 'LIBRE, esperando encargo (npm run flota -- repartir)'
          : 'SIN TAREA (dale una: flota -- encargar ' + f.trabajador + ')'}`)
      }

      // ── TUS SESIONES ────────────────────────────────────────────────────────────────
      // Las que tienes abiertas en pantalla. No se gobiernan desde aquí —son tuyas— pero salen,
      // porque «una sola pantalla» no puede significar «la mitad de lo que pasa».
      const ahora = new Date()
      const personas = todas.filter((s) => s.rol !== 'trabajador')
      // ⚠️ El cruce recibe TODAS las sesiones, no solo las tuyas. Pasarle solo las personas hacía
      // que cualquier tarea de un trabajador se leyera como «esa sesión nunca ha dado señal»,
      // porque su sesión simplemente no estaba en la lista. Medido el 05/08: el panel decía
      // «✅ toda la flota viva y trabajando» y, cuatro líneas más arriba, marcaba las CUATRO
      // tareas de esos mismos trabajadores como paradas. Cuatro falsos de cuatro: una alarma que
      // acierta cero veces se deja de leer, y entonces tampoco se ve la que sí importa.
      const { trabajando, paradas } = PARTE.cruzarTrabajo(tareas, todas, { ahora })
      const sidsTrabajadores = new Set(sesiones.map((s) => s.sid))
      // Lo de un trabajador ya lo cuenta el bloque de la flota, arriba, con su estado real. Aquí
      // solo lo TUYO, que es lo que el encabezado promete.
      const paradasTuyas = paradas.filter((p) => !sidsTrabajadores.has(p.sid))
      const vivasPersonas = personas.filter((s) => {
        const min = (ahora.getTime() - new Date(s.last_signal_at).getTime()) / 60000
        return min <= 45
      })
      if (vivasPersonas.length) {
        console.log(`\n👤 ${vivasPersonas.length} SESIÓN(ES) TUYAS (no se les manda trabajo: son tuyas)`)
        for (const p of vivasPersonas) {
          const t = tareas.find((x) => x.claimed_by === p.sid)
          const min = Math.round((ahora.getTime() - new Date(p.last_signal_at).getTime()) / 60000)
          console.log(`   ${(p.slug || '?').padEnd(16)} ${min < 1 ? 'ahora mismo' : `hace ${min} min`.padEnd(12)} ${t ? `${t.id} — ${String(t.title).slice(0, 44)}` : '(sin tarea cogida)'}`)
        }
      }
      if (paradasTuyas.length) {
        console.log(`\n🟠 ${paradasTuyas.length} TAREA(S) TUYAS SIN SEÑAL DE SU SESIÓN:`)
        for (const p of paradasTuyas) console.log(`   ${p.id}  ${String(p.title).slice(0, 56)} — ${p.detalle}`)
      }

      // Lo que espera a Manuel va SIEMPRE, aunque la flota esté perfecta: es lo único cuyo coste
      // corre mientras nadie lo lee.
      const sinMirar = entregas.filter((e) => REV.esperaRevision(e))
      const conVeredicto = entregas.filter((e) => REV.esperaDecision(e))
      if (conVeredicto.length) {
        const malas = conVeredicto.filter((e) => REV.devueltaConProblemas(e)).length
        console.log(`\n⚖️  ${conVeredicto.length} YA REVISADA(S) — hay veredicto y falta tu decisión` +
                    (malas ? ` (${malas} con problemas)` : ''))
        for (const e of conVeredicto) console.log(REV.lineaRevisada(e))
      }
      if (sinMirar.length) {
        console.log(`\n🙋 ${sinMirar.length} ENTREGADA(S) esperando que las revises:`)
        for (const e of sinMirar) console.log(`   ${e.id}  ${String(e.title).slice(0, 62)}`)
      }
      // ── BORRADORES: lo PRIMERO, porque es lo único que va a salir hacia una persona ────
      // «Siempre tengo que aprobar lo que se envía» (Manuel). Van separados de las preguntas y
      // por delante: una pregunta espera una decisión, un borrador espera un permiso, y
      // confundirlos haría que lo segundo se leyera como lo primero.
      const borradores = preguntas.filter((p) => p.kind === 'borrador')
      const dudas = preguntas.filter((p) => p.kind !== 'borrador')
      if (borradores.length) {
        console.log(`\n📝 ${borradores.length} BORRADOR(ES) esperando tu OK — nada de esto se ha enviado:`)
        for (const b of borradores) {
          console.log(`   #${b.id} → ${String(b.draft_target || '?').slice(0, 40)}  (${sidCorto(b.sid)})`)
          console.log(`        ${String(b.question).slice(0, 88)}`)
        }
        console.log('   léelos enteros:  node scripts/backlog.cjs preguntas')
      }
      if (dudas.length) {
        console.log(`\n❓ ${dudas.length} PREGUNTA(S):`)
        for (const p of dudas) console.log(`   ${sidCorto(p.sid)}: ${String(p.question).slice(0, 90)}`)
      }
      // ── ¿PUEDEN DE VERDAD TRABAJAR? (T-486) ────────────────────────────────────────
      // El latido dice que la máquina vive; no dice nada de Claude Code. Sin esta sonda, un
      // trabajador atascado en la pantalla de login sale 🟢 y ocupa sitio en el reparto sin
      // poder hacer nada — pasó en el primer arranque real, con los dos a la vez.
      // Cuesta cuota, así que va solo con --probar… salvo que alguno esté SIN TAREA, que es
      // justo el síntoma con el que se manifiesta.
      const sospechosos = filas.filter((f) => f.estado === 'vivo' && !tareaDe(f.trabajador))
      const probar = process.argv.includes('--probar') || sospechosos.length > 0
      const malAutenticados = []
      if (probar) {
        for (const f of (process.argv.includes('--probar') ? filas.filter((x) => x.estado === 'vivo') : sospechosos)) {
          let salida = ''
          try {
            salida = enMaquina(f.trabajador,
              (MAQ.maquinaDe(f.trabajador).local ? '' : 'sudo -u flota ') +
              `bash -c "set -a; . ${ficheroEntorno(f.trabajador)}; set +a; timeout 90 claude -p ` +
              `${JSON.stringify(AUT.SONDA).replace(/"/g, '\\"')} 2>&1" || true`)
          } catch (e) { salida = String(e.message || e) }
          const v = AUT.clasificar(salida, /\bok\b/i.test(salida) ? 0 : 1)
          if (!AUT.puedeTrabajar(v)) {
            malAutenticados.push({ trabajador: f.trabajador, v })
            // Al bus, para que la serie exista y se pueda ver si esto mejora o empeora.
            await sql`
              INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
              VALUES ('fargate', ${AUT.severidad(v)}, 'flota_autenticacion', 'flota', ${v.detalle},
                      ${sql.json({ trabajador: f.trabajador, maquina: f.maquina, estado: v.estado })})`
              .catch(() => {})
          }
        }
      }
      if (malAutenticados.length) {
        console.log(`\n🔑 ${malAutenticados.length} trabajador(es) NO pueden trabajar aunque estén latiendo:`)
        for (const m of malAutenticados) console.log(`   ${AUT.diagnostico(m.trabajador, m.v)}`)
      }

      // El resumen NO puede meter en el mismo saco «no da señal» y «da señal pero no puede
      // trabajar»: se arreglan en sitios distintos (la máquina vs. la credencial), y un resumen
      // que los confunde manda a mirar donde no es.
      const sinSenal = filas.filter((f) => f.estado !== 'vivo' && !sesionViva(f.trabajador))
      const partes = []
      if (sinSenal.length) partes.push(`${sinSenal.length} sin señal`)
      if (malAutenticados.length) partes.push(`${malAutenticados.length} sin poder trabajar`)
      if (abandonadas.length) partes.push(`${abandonadas.length} con la tarea cogida y SIN PROCESO`)
      console.log(partes.length ? `\n⚠️  ${partes.join(' · ')}` : '\n✅ toda la flota viva y trabajando')
      return partes.length ? 3 : 0
    }

    if (cmd === 'encargar') {
      const w = process.argv[3]
      if (!w) { console.error('Uso: flota.cjs encargar <trabajador> [--tarea T-nnn | --impugnaciones]'); return 2 }

      // ── IMPUGNACIONES: analizar SÍ, enviar NO ───────────────────────────────────────────
      // No pasa por el backlog: la cola de impugnaciones tiene su propio claim atómico
      // (`cola.cjs`, FOR UPDATE SKIP LOCKED), así que N trabajadores cogen N impugnaciones
      // distintas sin coordinarse. Lo que produce es un BORRADOR que aprueba una persona.
      if (process.argv.includes('--impugnaciones')) {
        const alDia = ponerAlDia(w, { emitir: (v) => { emitirClon(w, v) } })
        const r = mandarEncargo(w, ENC.encargoImpugnacion({ trabajador: w, puedeDesplegar: MAQ.puedeDesplegar(w).puede }),
          { alDia, turno: () => emitirTurno(w, 'encargado', { tipo: 'impugnacion' }) })
        if (!r.ok) {
          console.error(r.ocupado ? `❌ ${w} ${r.motivo}` : `❌ no se le manda encargo a ${w} hasta resolver eso.`)
          return 1
        }
        console.log(`✅ ${w} → analizar una impugnación (cogerá una libre de la cola). Dejará BORRADOR, no enviará nada.`)
        return 0
      }

      let tarea = null
      const pedida = arg('--tarea')
      if (pedida) {
        const [t] = await sql`SELECT id, title, claimed_by FROM public.backlog_tasks WHERE id = ${pedida}`
        if (!t) { console.error(`❌ ${pedida} no existe`); return 1 }
        const v = ENC.esApta(t)
        if (!v.apta) console.log(`⚠️  ${t.id} no parece apta para un trabajador (${v.motivo}) — se manda igual porque lo has pedido.`)
        tarea = t
      } else {
        // Candidatas: libres, sin espera, ordenadas como las ordena el backlog.
        const libres = await sql`
          SELECT id, title FROM public.backlog_tasks
           WHERE status = 'open' AND claimed_by IS NULL
             AND (snooze_until IS NULL OR snooze_until <= now())
             AND wake_on_deploy_sha IS NULL AND review_requested_at IS NULL
           ORDER BY CASE priority WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, id
           LIMIT 40`
        const { tarea: elegida, descartadas } = ENC.elegir(libres)
        if (!elegida) { console.error('❌ ninguna tarea libre resultó apta'); return 1 }
        tarea = elegida
        if (descartadas.length) {
          console.log(`   (descartadas ${descartadas.length} por delante: ${descartadas.slice(0, 3).map((d) => `${d.id} — ${d.motivo}`).join(' · ')})`)
        }
      }

      // ── EL CÓDIGO PRIMERO, LUEGO EL TRABAJO ─────────────────────────────────────────────
      // Un encargo sobre código viejo es tiempo que luego hay que tirar, y peor: son los
      // guardarraíles de otra fecha protegiendo a quien nadie mira.
      //
      // ¿Es RETOMAR lo suyo o empezar algo nuevo? Cambia el veredicto sobre un árbol a medias:
      // encima de un trabajo sin terminar no se empieza otra cosa, pero seguir el propio es
      // exactamente lo que hay que poder hacer.
      const [ses] = await sql`SELECT sid FROM public.worktree_sessions WHERE slug = ${w}`
      const reanuda = !!(ses && tarea.claimed_by === ses.sid)
      const alDia = ponerAlDia(w, { emitir: (v) => { emitirClon(w, v) }, reanuda })
      const r = mandarEncargo(w, ENC.encargo({ trabajador: w, tarea, puedeDesplegar: MAQ.puedeDesplegar(w).puede }),
        { alDia, turno: () => emitirTurno(w, 'encargado', { tarea: tarea.id, tipo: 'backlog' }) })
      if (!r.ok) {
        console.error(r.ocupado
          ? `❌ ${w} ${r.motivo} — espera a que termine, o míralo con: tmux attach -t ${w}`
          : `❌ no se le manda encargo a ${w} hasta resolver eso.`)
        return 1
      }
      console.log(`✅ encargo enviado a ${w}: ${tarea.id} — ${String(tarea.title).slice(0, 60)}`)
      console.log(`   míralo con:  npm run flota    (o tmux attach -t ${w} en la máquina)`)
      return 0
    }

    // ── PRODUCTIVIDAD: ¿produce, y a qué coste para Manuel? ───────────────────────────────
    // Va AQUÍ y no en un script suelto porque es la misma pregunta que el panel: cómo va la flota.
    // El ratio de escape de guardarraíles —el otro criterio declarado— ya lo mide
    // `npm run sesiones:friccion`, así que se REMITE a él en vez de calcularlo otra vez ([T-130]).
    if (cmd === 'productividad') {
      const dias = Math.max(1, Number(arg('--dias') || 7))
      const cerradas = await sql`
        SELECT id, closed_at AS done_at, claimed_by, worked_seconds, review_requested_by
          FROM public.backlog_tasks
         WHERE closed_at > now() - (${dias} || ' days')::interval`
      const entregadas = await sql`
        SELECT id, review_requested_at, review_requested_by,
        reviewed_at, reviewed_by, review_verdict
          FROM public.backlog_tasks
         WHERE review_requested_at IS NOT NULL AND status <> 'done'`
      const m = PROD.medir({ cerradas, entregadas, ahora: new Date() })

      // ── PREVISIÓN: hace falta el TAMAÑO de lo que queda y el RITMO reciente ─────────
      const [{ pendientes }] = await sql`
        SELECT count(*)::int AS pendientes FROM public.backlog_tasks WHERE status = 'open'`
      const horasVentana = Math.max(1, Number(arg('--ventana') || 6))
      const [{ entregasVentana }] = await sql`
        SELECT count(*)::int AS "entregasVentana" FROM public.backlog_tasks
         WHERE review_requested_at > now() - (${horasVentana} || ' hours')::interval
           AND review_requested_by ~ '^(w|l)[0-9]'`
      const [{ cerradasVentana }] = await sql`
        SELECT count(*)::int AS "cerradasVentana" FROM public.backlog_tasks
         WHERE closed_at > now() - (${horasVentana} || ' hours')::interval`
      const trabajadores = MAQ.trabajadoresEsperados().length
      m.pendientes = pendientes
      m.trabajadores = trabajadores
      m.prevision = PROD.prevision({ pendientes, entregasVentana, cerradasVentana, horasVentana, trabajadores })
      console.log('')
      for (const l of PROD.formatear(m, { dias })) console.log(l)
      console.log('')
      console.log('   el tercer criterio del piloto (¿se erosionan los guardarraíles?):')
      console.log('     npm run sesiones:friccion')
      // ── LA SERIE DURADERA ────────────────────────────────────────────────────────
      // El bus recibe la señal para ALERTAR, pero no sirve como historia: se poda (medido, 10,8 M
      // de filas y solo 32 días). Así que la medida se guarda también en su propia tabla, con las
      // ENTRADAS del cálculo y no solo el veredicto — si mañana se recalibran los umbrales, la
      // historia se puede volver a juzgar con el criterio nuevo.
      const [prev] = await sql`
        SELECT * FROM public.flota_productividad_historico ORDER BY medido_at DESC LIMIT 1`
      await sql`
        INSERT INTO public.flota_productividad_historico
          (horas_ventana, dias_cerradas, pendientes, trabajadores, cerradas, cerradas_flota,
           entregas_ventana, entregas_en_cola, espera_mediana_h, entregas_por_hora,
           cerradas_por_hora, manda, horas_estimadas, veredicto, razon)
        VALUES (${horasVentana}, ${dias}, ${pendientes}, ${trabajadores},
                ${m.porOrigen.trabajador + m.porOrigen.persona}, ${m.produccionFlota.entregadasYaCerradas},
                ${entregasVentana}, ${m.entregas.pendientes}, ${m.entregas.esperaMedianaH},
                ${m.prevision.hay ? m.prevision.entregasPorHora : null},
                ${m.prevision.hay ? m.prevision.cerradasPorHora : null},
                ${m.prevision.hay ? m.prevision.manda : null},
                ${m.prevision.hay ? m.prevision.horas : null},
                ${m.veredicto.color}, ${m.veredicto.razon})`.catch((e) => {
        console.log(`   (no se pudo guardar en el histórico: ${String(e.message).slice(0, 70)})`)
      })

      // ¿Mejor o peor que la anterior? Es la pregunta que motivó la tabla.
      const cmp = PROD.comparar({
        entregasPorHora: m.prevision.hay ? m.prevision.entregasPorHora : null,
        cerradasPorHora: m.prevision.hay ? m.prevision.cerradasPorHora : null,
        pendientes, entregasEnCola: m.entregas.pendientes,
        esperaMedianaH: m.entregas.esperaMedianaH,
        horasEstimadas: m.prevision.hay ? m.prevision.horas : null,
      }, prev ? {
        entregasPorHora: prev.entregas_por_hora, cerradasPorHora: prev.cerradas_por_hora,
        pendientes: prev.pendientes, entregasEnCola: prev.entregas_en_cola,
        esperaMedianaH: prev.espera_mediana_h, horasEstimadas: prev.horas_estimadas,
      } : null)
      console.log('')
      console.log('¿MEJOR O PEOR QUE LA MEDIDA ANTERIOR?')
      console.log('-'.repeat(58))
      if (!cmp.hay) console.log(`  ${cmp.motivo}`)
      else {
        const ico = { mejora: '📈', empeora: '📉', igual: '➖' }
        for (const f of cmp.filas) {
          console.log(`  ${ico[f.veredicto]} ${f.metrica.padEnd(18)} ${f.de} → ${f.a}   (${f.cambio > 0 ? '+' : ''}${Math.round(f.cambio * 100)}%)`)
        }
        console.log(`  ${ico[cmp.resumen]} en conjunto: ${cmp.resumen.toUpperCase()}` +
          (prev ? `   (frente a la medida de ${new Date(prev.medido_at).toISOString().slice(5, 16).replace('T', ' ')})` : ''))
      }

      // Al bus, para ALERTAR (la historia vive en la tabla de arriba).
      await sql`
        INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
        VALUES ('fargate', ${m.veredicto.color === 'rojo' ? 'error' : m.veredicto.color === 'ambar' ? 'warn' : 'info'},
                'flota_productividad', 'flota', ${m.veredicto.razon},
                ${sql.json({ dias, ...m.porOrigen, entregas: m.entregas, tiempo: m.tiempo })})`.catch(() => {})
      return m.veredicto.color === 'rojo' ? 3 : 0
    }

    // ── RESCATAR: poner a salvo lo que un trabajador dejó sin empujar ─────────────────────
    // La puerta del clon rehúsa darle trabajo nuevo a quien tiene cambios sin commitear, y hace
    // bien: pueden ser la única copia. Pero eso deja al trabajador ENCALLADO hasta que alguien lo
    // mira — pasó cuatro veces el 05/08 y las cuatro lo resolví a mano con los mismos tres
    // comandos. Un bloqueo que siempre se resuelve igual es trabajo que debería hacer la máquina.
    //
    // ── POR QUÉ ESTO SÍ SE PUEDE AUTOMATIZAR, Y `reset --hard` NO ──────────────────────────
    // Rescatar es **puramente aditivo**: commit en su propia rama y push. No puede perder nada —
    // en el peor caso deja un commit de más, que se descarta leyéndolo. Lo que destruye es lo
    // contrario (descartar), y eso sigue siendo de una persona.
    //
    // `--no-verify` a propósito: un commit de rescate NO introduce trabajo, lo CONSERVA. Las
    // comprobaciones tienen que pasar cuando alguien lleve eso a `main`, no para impedir que se
    // guarde. Sin esto el rescate moriría en el mismo `pre-commit` que ya bloqueó al trabajador.
    if (cmd === 'rescatar') {
      const quienes = process.argv[3] ? [process.argv[3]] : MAQ.trabajadoresEsperados().map((x) => x.trabajador)
      let n = 0
      for (const w of quienes) {
        const m = MAQ.maquinaDe(w)
        if (!m) { console.log(`   ⏭️  ${w}: no está declarado`); continue }
        const como = m.local ? '' : 'sudo -u flota '
        const arbol = MAQ.arbolDe(w)
        // La orden vive en `lib/flota/rescate.cjs` y NO se copia aquí: `npm run sim:rescate-flota`
        // la EJECUTA contra repos git desechables (rescata lo sin commitear, el commit huérfano,
        // no pisa una rama ajena divergida…). Reconstruirla a mano en la simulación probaría una
        // copia, y dos escritores del mismo hecho divergen.
        const orden = RESC.ordenRescate({ arbol, trabajador: w })
        let salida = ''
        try { salida = enMaquina(w, `${como}bash -lc ${citar(orden)}`) }
        catch (e) { salida = String((e && e.stdout) || e.message || '') }
        if (/OCUPADO/.test(salida)) {
          // No es un fallo: es un trabajador commiteando. Se recoge en el siguiente pase.
          console.log(`   ⏳ ${w}: está commiteando ahora mismo — no se le toca`); continue
        }
        if (/NADA/.test(salida)) { console.log(`   ✅ ${w}: nada que salvar`); continue }
        const ok = /SALVADO=0/.test(salida)
        // Un trabajador puede tener trabajo atrapado en VARIAS ramas a la vez (una por tarea
        // entregada), así que se listan todas: quedarse con la primera escondía las demás.
        const ramas = [...salida.matchAll(/^RAMA=(.+)$/gm)].map((m) => m[1].trim())
        const rama = ramas[0] || '(?)'
        console.log(ok
          ? `   💾 ${w}: ${ramas.length} rama(s) puesta(s) a salvo`
          : `   ❌ ${w}: NO se pudo poner a salvo — míralo tú (tmux attach -t ${w}) · ${salida.trim().slice(-120)}`)
        for (const r of ramas) console.log(`        → ${r}`)
        emitirTurno(w, ok ? 'rescatado' : 'rescate_fallido', { rama, ramas, motivo: ok ? null : 'no se pudo empujar lo que dejó sin salvar' })
        if (ok) n++
      }
      console.log(`\n${n} trabajador(es) rescatado(s).`)
      return 0
    }

    // ── VIGILAR: la flota se mantiene ocupada SOLA ────────────────────────────────────────
    // Hasta aquí el supervisor sabía repartir… pero solo cuando alguien se lo pedía. Y como el
    // turno de un `claude -p` muere al terminar, la consecuencia real era que **la flota se paraba
    // entera y nadie se enteraba hasta la siguiente vez que Manuel preguntaba** — medido el 05/08
    // más de una vez, con ocho trabajadores en pie y seis sin hacer nada.
    //
    // Un panel que hay que mirar no es vigilancia: es un panel. Esto es el bucle que faltaba.
    //
    // Lo que hace en cada vuelta, y NADA más:
    //   · a quien esté libre y vivo, le da trabajo (por el mismo `mandarEncargo`, con sus puertas)
    //   · a quien tenga tarea cogida y NINGÚN proceso, le relanza el turno con SU tarea
    // No responde preguntas, no aprueba borradores y no toca a las sesiones de Manuel: eso es de
    // una persona, y automatizarlo sería justo lo que este sistema no quiere.
    if (cmd === 'vigilar') {
      const cada = Math.max(60, Number(arg('--cada') || 300))
      const vueltas = Number(arg('--vueltas') || 0)   // 0 = para siempre
      console.log(`👁️  vigilando la flota cada ${cada}s${vueltas ? ` (${vueltas} vueltas)` : ''}. Ctrl-C para parar.`)
      for (let n = 1; !vueltas || n <= vueltas; n++) {
        const sesiones = await sql`
          SELECT sid, slug, last_signal_at FROM public.worktree_sessions WHERE rol = 'trabajador'`
        const enCurso = await sql`
          SELECT id, title, claimed_by FROM public.backlog_tasks
           WHERE status = 'in_progress' AND claimed_by IS NOT NULL`
        const porSlug = new Map(sesiones.map((x) => [x.slug, x.sid]))
        const tareaDe = (w) => enCurso.find((t) => t.claimed_by === porSlug.get(w))

        const sello = new Date().toISOString().slice(11, 19)
        // Dos trabajadores no pueden llevarse la MISMA tarea en la misma vuelta.
        const repartidas = new Set()
        let movidos = 0
        // Solo los que RECIBEN trabajo solos: el portátil quedó fuera del reparto automático
        // (`reparte: false`) porque es el sitio donde Manuel trabaja. Siguen existiendo para el
        // panel y para un encargo explícito.
        for (const { trabajador } of MAQ.trabajadoresQueReciben()) {
          if (!sesionViva(trabajador)) continue
          // ¿Está ejecutando algo? Entonces no se le toca, tenga tarea o no.
          if (!ENC.puedeRecibir(comandoDelPanel(trabajador)).libre) continue

          const suya = tareaDe(trabajador)
          try {
            if (suya) {
              // Tarea cogida y sin proceso: su turno murió. Se relanza CON SU TAREA, no con otra —
              // empezar algo nuevo encima de un trabajo a medias es como se pierde ese trabajo.
              const alDia = ponerAlDia(trabajador, { emitir: (v) => { emitirClon(trabajador, v) }, reanuda: true })
              const r = mandarEncargo(trabajador, ENC.encargo({ trabajador, tarea: suya, puedeDesplegar: MAQ.puedeDesplegar(trabajador).puede }),
                { alDia, turno: () => { emitirTurno(trabajador, 'muerto', { tarea: suya.id, motivo: 'turno terminado con la tarea cogida y sin proceso' }); emitirTurno(trabajador, 'encargado', { tarea: suya.id, tipo: 'retoma' }) } })
              if (r.ok) {
                // Un turno que murió con la tarea cogida es el fallo que más tiempo cuesta: la
                // tarea queda bloqueada para todos y nadie avanza. Sin esta señal solo se veía
                // mirando el panel en el momento justo.
                console.log(`   [${sello}] ↻ ${trabajador} retoma ${suya.id}`); movidos++
              }
              else console.log(`   [${sello}] ⏭️  ${trabajador}: ${r.ocupado ? r.motivo : r.al.estado}`)
            } else {
              // ── SE REPARTE POR CAPACIDAD, NO POR TURNO ───────────────────────────
              // Primera versión: alternar por el nombre. Funcionaba, pero repartía mal — mandaba
              // tareas de backlog a máquinas que no pueden cerrarlas.
              //
              // Una tarea de backlog casi siempre acaba en «desplegar y verificar en producción»,
              // y eso solo lo puede hacer quien comparte el candado del deploy (los locales). Una
              // impugnación, en cambio, es análisis puro: no despliega nada, así que la cierra
              // igual de bien un trabajador del VPS.
              //
              // Así que **quien puede cerrar el ciclo entero se lleva el backlog**, y quien no,
              // las impugnaciones. Sale más trabajo TERMINADO con los mismos trabajadores, que es
              // lo que se pedía; y deja de generarse cola de «hecho, falta desplegar».
              // ── PERO DESDE EL 05/08 NINGUNO VA A IMPUGNACIONES ──────────────────────────
              // Decisión de Manuel tras revisar la primera tanda. El motivo no es que analicen
              // mal —la que se verificó a fondo (`2477d39d`) la acertaron, y tres por separado—
              // sino DÓNDE cuesta el error: una impugnación acaba en un correo a una persona.
              //
              // Y ahí el criterio que evita el fallo no está en el repo: la trampa de las páginas
              // `support.microsoft.com/es-es` (que dan los atajos internacionales aunque la
              // instalación española use otros) y la prueba discriminante de localización viven
              // en la memoria de Manuel, no en el manual. Los tres trabajadores verificaron
              // contra esa página —la única fuente que el manual desaconseja— y ninguno aplicó la
              // prueba. Mientras ese conocimiento no baje al repo, van a repetirlo.
              //
              // En el backlog un error es un commit malo que la revisión caza, y hay 250 tareas
              // abiertas: ahí su volumen sí compensa. Para volver a activarlo: VENCE_FLOTA_IMPUGNACIONES=1.
              const IMPUGNACIONES_A_LA_FLOTA = ENC.flotaCogeImpugnaciones()
              const aImpugnaciones = IMPUGNACIONES_A_LA_FLOTA && !MAQ.puedeDesplegar(trabajador).puede
              let texto = null, queEs = null
              if (!aImpugnaciones) {
                const libres = await sql`
                  SELECT id, title FROM public.backlog_tasks
                   WHERE status = 'open' AND claimed_by IS NULL
                     AND (snooze_until IS NULL OR snooze_until <= now())
                     AND wake_on_deploy_sha IS NULL AND review_requested_at IS NULL
                   ORDER BY CASE priority WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, id
                   LIMIT 60`
                const { tarea: elegida } = ENC.elegir(libres.filter((t) => !repartidas.has(t.id)), { puedeDesplegar: MAQ.puedeDesplegar(trabajador).puede })
                if (elegida) {
                  repartidas.add(elegida.id)
                  texto = ENC.encargo({ trabajador, tarea: elegida, puedeDesplegar: MAQ.puedeDesplegar(trabajador).puede })
                  queEs = elegida.id
                }
              }
              // Sin tarea apta libre, antes se caía a impugnaciones («mejor eso que pararlo»). Ya
              // no: con la flota fuera de esa cola, un trabajador ocioso es preferible a uno
              // escribiéndole a una persona. Se dice en voz alta para que se vea el hueco.
              if (!texto) {
                if (!IMPUGNACIONES_A_LA_FLOTA) {
                  console.log(`   [${sello}] ⏸️  ${trabajador}: sin tarea apta libre (no se le dan impugnaciones)`)
                  continue
                }
                texto = ENC.encargoImpugnacion({ trabajador, puedeDesplegar: MAQ.puedeDesplegar(trabajador).puede }); queEs = 'una impugnación'
              }
              const alDia = ponerAlDia(trabajador, { emitir: (v) => { emitirClon(trabajador, v) } })
              const r = mandarEncargo(trabajador, texto,
                { alDia, turno: () => emitirTurno(trabajador, 'encargado', { tarea: queEs.startsWith('T-') ? queEs : null, tipo: queEs.startsWith('T-') ? 'backlog' : 'impugnacion' }) })
              if (r.ok) {
                console.log(`   [${sello}] ✅ ${trabajador} → ${queEs}`); movidos++
              }
              else console.log(`   [${sello}] ⏭️  ${trabajador}: ${r.ocupado ? r.motivo : r.al.estado}`)
            }
          } catch (e) {
            console.log(`   [${sello}] ❌ ${trabajador}: ${String(e.message || e).slice(0, 70)}`)
          }
        }
        if (!movidos) console.log(`   [${sello}] todo en marcha, nada que repartir`)
        if (vueltas && n === vueltas) break
        await new Promise((r) => setTimeout(r, cada * 1000))
      }
      return 0
    }

    // ── LANZAR UN TRABAJADOR EN EL PORTÁTIL ───────────────────────────────────────────────
    // El equivalente local de `arrancar-trabajador.sh`, sin usuario nuevo ni systemd: la sesión es
    // TUYA, no del sistema. Lo que sí se conserva es lo que importa — árbol propio desde
    // origin/main, credenciales RESTRINGIDAS (no tu .env.local, que abre usuarios y pagos) y el
    // preflight como puerta: si no puede latir, no arranca.
      // ── LO REPARTIDO HACE POCO, SEGÚN LA BD ─────────────────────────────────────────────
      // El `Set` de repartidas vive en RAM y muere con el proceso, así que dos invocaciones
      // seguidas de `repartir` daban la MISMA tarea a dos trabajadores — pasó dos veces el 06/08
      // (T-038 a w3 y w4; T-533 a w2 y w3). La memoria tiene que estar donde sobreviva, y ya
      // existe: cada encargo emite un `flota_turno` con su tarea. Se lee de ahí.
      const repartidasHacePoco = new Set((await sql`
        SELECT metadata->>'tarea' AS tarea
          FROM public.observable_events
         WHERE event_type = 'flota_turno'
           AND created_at > now() - interval '25 minutes'
           AND metadata->>'fase' = 'encargado'
           AND metadata->>'tarea' IS NOT NULL`).map((r) => r.tarea))
      if (repartidasHacePoco.size) {
        console.log(`   (${repartidasHacePoco.size} tarea(s) repartida(s) hace <25 min: no se repiten)`)
      }

    // ── REPARTIR: dar trabajo a TODOS los que estén libres, de una vez ────────────────────
    // Es lo que cierra el bucle. Sin esto, «hablo solo con el supervisor» seguía significando
    // «pídele trabajo a w1, luego a w2, luego a l1»: el supervisor sabía quién estaba libre y aun
    // así había que decírselo uno a uno.
    //
    // NO reparte a las sesiones de Manuel, ni con --todos: a una terminal de una persona no se le
    // manda un encargo. Y no reparte a quien ya tiene tarea — el claim manda, no esta lista.
    if (cmd === 'repartir') {
      const sesiones = await sql`
        SELECT sid, slug, last_signal_at FROM public.worktree_sessions WHERE rol = 'trabajador'`
      const ocupadas = await sql`
        SELECT claimed_by FROM public.backlog_tasks WHERE status = 'in_progress' AND claimed_by IS NOT NULL`
      const conTarea = new Set(ocupadas.map((t) => t.claimed_by))
      // «Vivo» aquí es «hay sesión a la que mandarle algo», no «ha latido hace poco»: un
      // trabajador entre tareas no late y seguiría siendo un destinatario perfectamente válido.
      // …y que además RECIBAN reparto: el portátil está fuera (`reparte: false`), porque es donde
      // Manuel abre sus consolas y seis autónomos se lo dejaban parado.
      const reciben = new Set(MAQ.trabajadoresQueReciben().map((x) => x.trabajador))
      const vivos = MAQ.comparar(sesiones)
        .filter((f) => reciben.has(f.trabajador))
        .filter((f) => f.estado === 'vivo' || sesionViva(f.trabajador))
      const porSlug = new Map(sesiones.map((s) => [s.slug, s.sid]))
      const libres = vivos.filter((f) => !conTarea.has(porSlug.get(f.trabajador)))

      if (!libres.length) {
        console.log(`✅ nada que repartir: ${vivos.length} trabajador(es) vivo(s), todos con tarea.`)
        return 0
      }
      const candidatas = await sql`
        SELECT id, title FROM public.backlog_tasks
         WHERE status = 'open' AND claimed_by IS NULL
           AND (snooze_until IS NULL OR snooze_until <= now())
           AND wake_on_deploy_sha IS NULL AND review_requested_at IS NULL
         ORDER BY CASE priority WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, id
         LIMIT 120`
      const dadas = new Set()
      let n = 0
      for (const f of libres) {
        // Cada uno se lleva una DISTINTA: repartir la misma a dos es exactamente la colisión que
        // el claim evita, pero mandarles a los dos a por ella desperdicia una vuelta entera.
        // Mismo criterio que el vigía: quien puede cerrar el ciclo entero se lleva el backlog;
        // quien no, impugnaciones (análisis puro, sin deploy). Si esto no fuera igual en los dos
        // sitios, el reparto dependería de por dónde entrases — que es como una de las dos puertas
        // se queda sin lo que se añade a la otra ([T-130]).
        if (ENC.flotaCogeImpugnaciones() && !MAQ.puedeDesplegar(f.trabajador).puede) {
          try {
            const alDia = ponerAlDia(f.trabajador, { emitir: (v) => { emitirClon(f.trabajador, v) } })
            const r = mandarEncargo(f.trabajador,
              ENC.encargoImpugnacion({ trabajador: f.trabajador, puedeDesplegar: false }),
              { alDia, turno: () => emitirTurno(f.trabajador, 'encargado', { tipo: 'impugnacion' }) })
            if (r.ok) { console.log(`   ✅ ${f.trabajador.padEnd(4)} → una impugnación (no despliega: ${MAQ.puedeDesplegar(f.trabajador).porQueNo})`); n++ }
            else console.log(`   ⏭️  ${f.trabajador}: ${r.ocupado ? r.motivo : r.al.estado}`)
          } catch (e) { console.log(`   ❌ ${f.trabajador}: ${String(e.message).slice(0, 60)}`) }
          continue
        }
        // ── PRIMERO REVISAR, LUEGO HACER (T-486, 06/08) ──────────────────────────────────
        // Las revisiones van ANTES que las tareas nuevas porque son el escalón que se atasca: dar
        // otra tarea a quien podría desatascar una entrega hace crecer la cola por los dos lados.
        // Nunca la SUYA (no se revisa lo propio) ni una ya revisada.
        const porRevisar = (await sql`
          SELECT id, title, review_note, review_requested_by
            FROM public.backlog_tasks
           WHERE review_requested_at IS NOT NULL AND reviewed_at IS NULL
             AND review_requested_by IS DISTINCT FROM ${porSlug.get(f.trabajador) || ''}
           ORDER BY review_requested_at
           LIMIT 8`).filter((t) => !dadas.has(t.id) && !repartidasHacePoco.has(t.id))[0]
        if (porRevisar) {
          dadas.add(porRevisar.id)
          try {
            const alDia = ponerAlDia(f.trabajador, { emitir: (v) => { emitirClon(f.trabajador, v) } })
            const r = mandarEncargo(f.trabajador,
              ENC.encargoRevision({ trabajador: f.trabajador, tarea: porRevisar,
                entrega: porRevisar.review_note, autor: porRevisar.review_requested_by }),
              { alDia, turno: () => emitirTurno(f.trabajador, 'encargado', { tarea: porRevisar.id, tipo: 'revision' }) })
            if (r.ok) { console.log(`   🔍 ${f.trabajador.padEnd(4)} → REVISAR ${porRevisar.id}`); n++; continue }
            dadas.delete(porRevisar.id)
          } catch (e) { dadas.delete(porRevisar.id); console.log(`   ❌ ${f.trabajador}: ${String(e.message).slice(0, 60)}`) }
        }
        const { tarea } = ENC.elegir(candidatas.filter((t) => !dadas.has(t.id) && !repartidasHacePoco.has(t.id)), { puedeDesplegar: true })
        if (!tarea) { console.log(`   ⏭️  ${f.trabajador}: no queda ninguna tarea apta libre`); continue }
        try {
          const alDia = ponerAlDia(f.trabajador, { emitir: (v) => { emitirClon(f.trabajador, v) } })
          const r = mandarEncargo(f.trabajador, ENC.encargo({ trabajador: f.trabajador, tarea, puedeDesplegar: MAQ.puedeDesplegar(f.trabajador).puede }),
            { alDia, turno: () => emitirTurno(f.trabajador, 'encargado', { tarea: tarea.id, tipo: 'backlog' }) })
          // Si no se le pudo mandar, la tarea NO se marca como dada: se la lleva el siguiente en
          // vez de quedarse sin repartir por un problema que no es suyo.
          // Si no se le pudo mandar, la tarea NO se marca como dada: se la lleva el siguiente en
          // vez de quedarse sin repartir por un problema que no es suyo.
          if (!r.ok) {
            console.log(`   ⏭️  ${f.trabajador}: ${r.ocupado ? r.motivo : `no se le encarga (${r.al.estado})`}`)
            continue
          }
          dadas.add(tarea.id)
          console.log(`   ✅ ${f.trabajador.padEnd(4)} → ${tarea.id}  ${String(tarea.title).slice(0, 54)}`)
          n++
        } catch (e) {
          console.log(`   ❌ ${f.trabajador}: no se le pudo mandar (${String(e.message).slice(0, 60)})`)
        }
      }
      // ── LO QUE LA FLOTA NUNCA VA A COGER ────────────────────────────────────────────────
      // La criba de `esApta` es un filtro de TEXTO y siempre tendrá falsos: [T-585] —corpus
      // documental, trabajo de contenido puro— llevaba rondas saltándose sola porque su ficha dice
      // «factura 1.691 €/90d» para justificar su prioridad, y en este repo casi toda tarea valiosa
      // se justifica así.
      //
      // Lo que hacía daño no era el falso positivo: era que **nadie podía saberlo**. Una tarea que
      // el reparto salta en cada vuelta no aparece en ningún sitio — ni como error, ni como aviso.
      // Se queda abierta para siempre y parece que nadie la ha cogido por casualidad.
      const abiertas = await sql`
        SELECT id, title FROM public.backlog_tasks
         WHERE status = 'open' AND claimed_by IS NULL
           AND (snooze_until IS NULL OR snooze_until <= now())
           AND wake_on_deploy_sha IS NULL AND review_requested_at IS NULL`
      const porMotivo = new Map()
      for (const t of abiertas) {
        const v = ENC.esApta(t, { puedeDesplegar: true })
        if (v.apta) continue
        if (!porMotivo.has(v.motivo)) porMotivo.set(v.motivo, [])
        porMotivo.get(v.motivo).push(t.id)
      }
      if (porMotivo.size) {
        const total = [...porMotivo.values()].reduce((a, b) => a + b.length, 0)
        console.log(`\n🚫 ${total} tarea(s) libres que la flota NUNCA cogerá sola:`)
        for (const [motivo, ids] of [...porMotivo].sort((a, b) => b[1].length - a[1].length)) {
          console.log(`   ${String(ids.length).padStart(3)} · ${motivo}`)
          console.log(`        ${ids.slice(0, 6).join(' ')}${ids.length > 6 ? ` …y ${ids.length - 6} más` : ''}`)
        }
        console.log('   Si alguna NO debería estar aquí, es un falso positivo de la criba:')
        console.log('   se le puede mandar igual con  npm run flota -- encargar <w> --tarea <id>')
      }

      console.log(`\n${n} encargo(s) repartido(s). Míralo con: npm run flota`)
      return 0
    }

    // ── EL SUPERVISOR CONTINUO (T-486, 06/08) ────────────────────────────────────────────
    // Pregunta de Manuel: «¿por qué el supervisor no les da tareas continuamente? así no es
    // productivo». No existía programador ninguno: `repartir` se corría a mano, así que la flota
    // trabajaba solo mientras alguien la mirase. Esto es la otra mitad del arreglo — la primera
    // es que el encargo ahora manda ENCADENAR dentro del turno; esto arranca uno nuevo cuando
    // un trabajador termina de verdad.
    //
    // NO reimplementa el reparto: LANZA `flota.cjs repartir` como hijo. Una segunda copia de la
    // criba acabaría entregando cosas distintas según quién repartiera, que es exactamente el
    // fallo de los cinco escritores de `seguimiento_url` [T-130]. Y de regalo, aísla: si una
    // pasada revienta, el bucle sigue vivo.
    if (cmd === 'bucle') {
      const BUC = require(path.join(REPO, 'lib', 'flota', 'bucle.cjs'))
      const cada = Math.max(60, Number(arg('--cada') || BUC.CADA_S))
      const limiteAtasco = Math.max(10, Number(arg('--atascado') || BUC.ATASCADO_MIN))
      let pausa = cada
      let parar = false
      // Salida limpia: systemd manda SIGTERM al reiniciar, y matar el bucle en mitad de una
      // pasada dejaría un `repartir` huérfano lanzando encargos que nadie va a vigilar.
      for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { parar = true })

      console.log(`🔁 supervisor continuo — pasada cada ${Math.round(cada / 60)} min · atasco a los ${limiteAtasco} min`)
      while (!parar) {
        let repartidos = 0
        let motivoSalto = null
        let atascados = []
        try {
          const puede = BUC.puedeRepartir({
            hayBd: Boolean(url()),
            hayTrabajadores: MAQ.trabajadoresQueReciben().length > 0,
          })
          if (!puede.ok) {
            motivoSalto = puede.motivo
          } else {
            // Turnos abiertos demasiado tiempo. Se AVISA, no se mata: matar un turno puede tirar
            // trabajo sin commitear, y eso ya tiene ficha propia [T-577]. Caso que lo calibra:
            // el 06/08 un `git commit` de w1 llevaba 2 h con un worker de jest al 99,8% de CPU.
            const turnos = MAQ.trabajadoresQueReciben().map(({ trabajador }) => {
              try {
                const t = enMaquina(trabajador, `stat -c %Y ${ficheroEncargo(trabajador)} 2>/dev/null || true`).trim()
                return { trabajador, inicio: t ? new Date(Number(t) * 1000) : null }
              } catch { return { trabajador, inicio: null } }
            })
            atascados = BUC.turnosAtascados(turnos, { limiteMin: limiteAtasco })
            const r = execFileSync(process.execPath, [__filename, 'repartir'], { encoding: 'utf8', timeout: 600_000 })
            process.stdout.write(r)
            const m = r.match(/(\d+)\s+encargo\(s\) repartido/)
            repartidos = m ? Number(m[1]) : 0
          }
        } catch (e) {
          // Una pasada que falla NO para el bucle: la flota se quedaría parada por un SSH caído.
          motivoSalto = `la pasada falló: ${String(e.message || e).slice(0, 120)}`
        }
        pausa = BUC.siguientePausa({ repartidos, cada, anterior: pausa })
        console.log(BUC.resumenPasada({ repartidos, atascados, motivoSalto, pausaS: pausa }))
        // Rastro en la BD: un bucle que no deja huella es indistinguible de uno muerto, y el
        // síntoma de un supervisor muerto es justamente que NO PASA NADA.
        try {
          await sql`INSERT INTO public.observable_events (event_type, severity, event_data)
                    VALUES ('flota_bucle_pasada', ${motivoSalto ? 'warn' : 'info'},
                            ${sql.json({ repartidos, atascados, motivoSalto, pausaS: pausa })})`
        } catch { /* la telemetría nunca puede parar al supervisor */ }
        if (parar) break
        await new Promise((r) => setTimeout(r, pausa * 1000))
      }
      console.log('🛑 supervisor continuo detenido')
      return 0
    }

    if (cmd === 'lanzar') {
      const w = process.argv[3]
      if (!w) { console.error('Uso: flota.cjs lanzar <trabajador>'); return 2 }
      const m = MAQ.maquinaDe(w)
      if (!m) { console.error(`❌ ${w} no está declarado en lib/flota/maquinas.cjs`); return 1 }
      if (!m.local) {
        console.error(`❌ ${w} vive en ${MAQ.maquinaDe(w) && 'una máquina remota'}: se levanta allí con`)
        console.error('   scripts/flota/arrancar-trabajador.sh ' + w)
        return 2
      }
      // Las credenciales salen de SSM, que es donde ya viven. Así «lanzar» es un comando y no un
      // ritual de exportar variables.
      const desdeSsm = (nombre) => {
        try {
          return execFileSync('aws', ['--profile', 'vence', '--region', 'eu-west-2', 'ssm',
            'get-parameter', '--name', nombre, '--with-decryption',
            '--query', 'Parameter.Value', '--output', 'text'], { encoding: 'utf8' }).trim()
        } catch { return null }
      }
      const host = 'vence-prod.c1mkcg6astb0.eu-west-2.rds.amazonaws.com:5432/app'
      const pCoord = process.env.VENCE_COORDINACION_PASS || desdeSsm('/vence-flota/COORDINACION_DB_PASSWORD')
      const pLector = process.env.VENCE_LECTOR_PASS || desdeSsm('/vence-flota/LECTOR_DB_PASSWORD')
      if (!pCoord) { console.error('❌ no pude leer la credencial de coordinación de SSM'); return 1 }
      const urlCoord = `postgres://vence_coordinacion:${pCoord}@${host}`
      const urlLector = pLector ? `postgres://vence_lector:${pLector}@${host}` : ''

      const casa = process.env.HOME
      const wt = `${casa}/vence-sessions/${w}`
      const env = ficheroEntorno(w)
      // El checkout PRINCIPAL, preguntándoselo a git en vez de recortando rutas a mano: el
      // supervisor puede estar corriendo desde cualquier worktree, y `REPO.replace(...)` daba
      // /home/manuel — que no es un repo. Lo mismo que hace crear-worktree.sh.
      const gitCommon = execFileSync('git', ['rev-parse', '--git-common-dir'],
        { cwd: REPO, encoding: 'utf8' }).trim()
      const repo = path.resolve(REPO, gitCommon, '..')
      const token = process.env.CLAUDE_CODE_OAUTH_TOKEN || ''
      if (!token) {
        console.error('❌ falta CLAUDE_CODE_OAUTH_TOKEN en tu entorno (o expórtalo antes de lanzar).')
        return 1
      }

      console.log(`→ montando ${w} en el portátil…`)

      // ── LOS SECRETOS VAN POR STDIN, NUNCA DENTRO DEL SCRIPT ──────────────────────────────
      // La primera versión los interpolaba en el propio script de shell, y al fallar un paso bash
      // imprimió el comando entero — con las dos contraseñas dentro. Hubo que rotarlas. Un secreto
      // en la línea de órdenes se ve en `ps`; en el cuerpo de un script se ve en CUALQUIER error.
      enMaquina(w, `[ -d ${wt} ] || (cd ${repo} && scripts/worktrees/crear-worktree.sh ${w} >/dev/null 2>&1)`)

      const envWorktree = `DATABASE_URL=${urlCoord}\n` + (urlLector ? `VENCE_LECTOR_URL=${urlLector}\n` : '')
      enMaquina(w, `umask 077 && cat > ${wt}/.env.local`, { entrada: envWorktree })

      // La ruta ABSOLUTA de claude, resuelta en la máquina con un shell de LOGIN. La sesión de
      // tmux arranca un bash no interactivo que no carga el .bashrc, así que `claude` a secas no
      // está en su PATH — y el trabajador moría con «instrucción no encontrada» sin que nada más
      // fallara. Guardarla aquí vale para local y para remoto sin casos especiales.
      let claudeBin = 'claude'
      try {
        claudeBin = enMaquina(w, `bash -lc 'command -v claude'`).trim() || 'claude'
      } catch { /* si no se puede resolver, se deja el nombre y fallará de forma visible */ }

      const envTrabajador = [
        `CLAUDE_BIN=${claudeBin}`,
        `CLAUDE_CODE_OAUTH_TOKEN=${token}`,
        'VENCE_SESSION_ROLE=trabajador',
        `VENCE_SESSION_HOME=${wt}`,
        `DATABASE_URL=${urlCoord}`,
        ...(urlLector ? [`VENCE_LECTOR_URL=${urlLector}`] : []),
        '',
      ].join('\n')
      enMaquina(w, `umask 077 && mkdir -p "$(dirname ${env})" && cat > ${env} && chmod 600 ${env}`,
        { entrada: envTrabajador })

      // La PUERTA: si no puede participar del reparto, no se arranca.
      try {
        const salida = enMaquina(w, `cd ${wt} && set -a && . ${env} && set +a && npm run --silent sesion:preflight`)
        console.log('   ' + salida.trim().split('\n').pop())
      } catch (e) {
        console.error('❌ el preflight dice que no está listo — no se arranca.')
        console.error(String((e.stdout || '') + (e.stderr || '')).trim().slice(-500))
        return 1
      }
      enMaquina(w, `tmux has-session -t ${w} 2>/dev/null || tmux new-session -d -s ${w} -c ${wt} /bin/bash`)
      console.log(`✅ ${w} en marcha en el portátil (${wt})`)
      console.log(`   dale trabajo:  npm run flota -- encargar ${w}`)
      return 0
    }

    if (cmd === 'arrancar' || cmd === 'parar') {
      const w = process.argv[3]
      if (!w) { console.error(`Uso: flota.cjs ${cmd} <trabajador>`); return 2 }
      const m = MAQ.maquinaDe(w)
      if (!m) { console.error(`❌ ${w} no está declarado en ninguna máquina`); return 1 }
      if (m.local) {
        // En el portátil no hay unidad de systemd que valga: la sesión es tuya, no del sistema.
        enMaquina(w, cmd === 'arrancar'
          ? `tmux has-session -t ${w} 2>/dev/null || tmux new-session -d -s ${w} -c "$HOME/vence-sessions/${w}" /bin/bash`
          : `tmux kill-session -t ${w} 2>/dev/null || true`)
      } else {
        const accion = cmd === 'arrancar' ? 'start' : 'stop'
        enMaquina(w, `systemctl ${accion} vence-flota@${w} && systemctl is-active vence-flota@${w}`)
      }
      console.log(`✅ ${w}: ${cmd === 'arrancar' ? 'arrancado' : 'parado'}`)
      return 0
    }

    console.error('Uso: flota.cjs [estado] | productividad [--dias 7] | vigilar [--cada 300] | repartir | rescatar [<w>] | lanzar <w> | encargar <w> [--tarea T-nnn] | arrancar <w> | parar <w>')
    return 2
  } finally {
    try { await sql.end({ timeout: 5 }) } catch {}
  }
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌ flota:', e.message); process.exit(1) })
