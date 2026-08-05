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
// El cruce tarea↔señal ya lo resuelve el parte: se REUSA, no se copia (T-130).
const PARTE = require(path.join(REPO, 'lib', 'sessions', 'parte.cjs'))

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
function ponerAlDia(trabajador, { emitir = null } = {}) {
  const como = MAQ.maquinaDe(trabajador)?.local ? '' : 'sudo -u flota '
  const arbol = MAQ.arbolDe(trabajador)
  let salida = ''
  try {
    salida = enMaquina(trabajador, `${como}bash -lc ${citar(ACTU.SONDA_GIT(arbol))}`)
  } catch (e) { salida = String((e && e.stdout) || '') }
  const v = ACTU.evaluarClon(ACTU.leerSonda(salida))

  let commits = null
  if (v.hayQueActualizar) {
    try {
      commits = `ahora en ${enMaquina(trabajador, `${como}bash -lc ${citar(ACTU.ORDEN_ACTUALIZAR(arbol))}`).trim()}`
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
function mandarEncargo(trabajador, texto, { alDia = null } = {}) {
  // ¿Está libre AHORA? El claim tarda minutos en aparecer desde que se manda el encargo, y en esa
  // ventana el trabajador es invisible para el reparto. La verdad la tiene su panel.
  const ocupacion = ENC.puedeRecibir(comandoDelPanel(trabajador))
  if (!ocupacion.libre) return { ok: false, ocupado: true, motivo: ocupacion.motivo }

  const al = alDia || ponerAlDia(trabajador)
  if (al.linea) console.log(`   ${al.linea}`)
  if (!al.puedeEncargar) return { ok: false, al }

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
      const entregas = await sql`
        SELECT id, title, review_requested_by FROM public.backlog_tasks
         WHERE review_requested_at IS NOT NULL AND status <> 'done'`
      const preguntas = await sql`
        SELECT id, sid, question FROM public.session_questions WHERE status = 'open'`.catch(() => [])

      const filas = MAQ.comparar(sesiones)
      const porSid = new Map(sesiones.map((s) => [s.slug, s.sid]))
      const tareaDe = (slug) => tareas.find((t) => t.claimed_by === porSid.get(slug))

      console.log('\nFLOTA')
      console.log('='.repeat(60))
      for (const f of filas) {
        // Un trabajador callado PERO con sesión viva está LIBRE, no caído. Confundirlos manda a
        // levantar lo que solo hacía falta encargar.
        const libre = f.estado !== 'vivo' && sesionViva(f.trabajador)
        const icono = f.estado === 'vivo' ? '🟢' : libre ? '🔵' : f.estado === 'callado' ? '🟠' : '🔴'
        const t = tareaDe(f.trabajador)
        const cuando = f.antiguedadMin == null ? 'sin señal nunca'
          : f.antiguedadMin < 1 ? 'ahora mismo' : `hace ${f.antiguedadMin} min`
        console.log(`  ${icono} ${f.trabajador.padEnd(4)} ${f.maquina.padEnd(9)} ${cuando}`)
        console.log(`       ${t ? `${t.id} — ${String(t.title).slice(0, 60)}`
          : libre ? 'LIBRE, esperando encargo (npm run flota -- repartir)'
          : 'SIN TAREA (dale una: flota -- encargar ' + f.trabajador + ')'}`)
      }

      // ── TUS SESIONES ────────────────────────────────────────────────────────────────
      // Las que tienes abiertas en pantalla. No se gobiernan desde aquí —son tuyas— pero salen,
      // porque «una sola pantalla» no puede significar «la mitad de lo que pasa».
      const ahora = new Date()
      const personas = todas.filter((s) => s.rol !== 'trabajador')
      const { trabajando, paradas } = PARTE.cruzarTrabajo(tareas, personas, { ahora })
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
      if (paradas.length) {
        console.log(`\n🟠 ${paradas.length} TAREA(S) TUYAS SIN SEÑAL DE SU SESIÓN:`)
        for (const p of paradas) console.log(`   ${p.id}  ${String(p.title).slice(0, 56)} — ${p.detalle}`)
      }

      // Lo que espera a Manuel va SIEMPRE, aunque la flota esté perfecta: es lo único cuyo coste
      // corre mientras nadie lo lee.
      if (entregas.length) {
        console.log(`\n🙋 ${entregas.length} ENTREGADA(S) esperando que las revises:`)
        for (const e of entregas) console.log(`   ${e.id}  ${String(e.title).slice(0, 62)}`)
      }
      if (preguntas.length) {
        console.log(`\n❓ ${preguntas.length} PREGUNTA(S):`)
        for (const p of preguntas) console.log(`   ${sidCorto(p.sid)}: ${String(p.question).slice(0, 90)}`)
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
      console.log(partes.length ? `\n⚠️  ${partes.join(' · ')}` : '\n✅ toda la flota viva y trabajando')
      return partes.length ? 3 : 0
    }

    if (cmd === 'encargar') {
      const w = process.argv[3]
      if (!w) { console.error('Uso: flota.cjs encargar <trabajador> [--tarea T-nnn]'); return 2 }
      let tarea = null
      const pedida = arg('--tarea')
      if (pedida) {
        const [t] = await sql`SELECT id, title FROM public.backlog_tasks WHERE id = ${pedida}`
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
      const alDia = ponerAlDia(w, { emitir: (v) => { emitirClon(w, v) } })
      const r = mandarEncargo(w, ENC.encargo({ trabajador: w, tarea }), { alDia })
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

    // ── LANZAR UN TRABAJADOR EN EL PORTÁTIL ───────────────────────────────────────────────
    // El equivalente local de `arrancar-trabajador.sh`, sin usuario nuevo ni systemd: la sesión es
    // TUYA, no del sistema. Lo que sí se conserva es lo que importa — árbol propio desde
    // origin/main, credenciales RESTRINGIDAS (no tu .env.local, que abre usuarios y pagos) y el
    // preflight como puerta: si no puede latir, no arranca.
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
      const vivos = MAQ.comparar(sesiones).filter((f) => f.estado === 'vivo' || sesionViva(f.trabajador))
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
        const { tarea } = ENC.elegir(candidatas.filter((t) => !dadas.has(t.id)))
        if (!tarea) { console.log(`   ⏭️  ${f.trabajador}: no queda ninguna tarea apta libre`); continue }
        try {
          const alDia = ponerAlDia(f.trabajador, { emitir: (v) => { emitirClon(f.trabajador, v) } })
          const r = mandarEncargo(f.trabajador, ENC.encargo({ trabajador: f.trabajador, tarea }), { alDia })
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
      console.log(`\n${n} encargo(s) repartido(s). Míralo con: npm run flota`)
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

    console.error('Uso: flota.cjs [estado] | repartir | lanzar <w> | encargar <w> [--tarea T-nnn] | arrancar <w> | parar <w>')
    return 2
  } finally {
    try { await sql.end({ timeout: 5 }) } catch {}
  }
}

main().then((c) => process.exit(c)).catch((e) => { console.error('❌ flota:', e.message); process.exit(1) })
