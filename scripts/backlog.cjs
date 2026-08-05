#!/usr/bin/env node
// Gestor de CLAIM del backlog general (docs/roadmap/tareas-pendientes.md) para que
// 2-10 sesiones de Claude Code se repartan las tareas SIN pisarse.
//
// Hermano de scripts/impugnaciones/cola.cjs (mismas convenciones: RDS vía pg, session-id
// auto-derivado, claim atómico con FOR UPDATE SKIP LOCKED). Diferencia deliberada: aquí
// las tareas se eligen por PRIORIDAD y encaje, no FIFO → existe `claim <id>` explícito.
//
// LEASE, NO LOCK: `lease_until` renovable por heartbeat. Una sesión que muere libera la
// tarea sola al caducar; una sesión viva la conserva mientras dé señales.
//
// Uso:
//   node scripts/backlog.cjs list [--all]              # pool + quién tiene qué
//   node scripts/backlog.cjs next                      # sugiere la siguiente por prioridad (no coge)
//   node scripts/backlog.cjs claim T-042               # COGE una concreta (atómico)
//   node scripts/backlog.cjs heartbeat                 # renueva el lease de las tuyas
//   node scripts/backlog.cjs mine
//   node scripts/backlog.cjs done T-042 --outcome "…"  # cierra + deja constancia
//   node scripts/backlog.cjs reopen T-042 --motivo "…" # deshace un cierre equivocado
//   node scripts/backlog.cjs release T-042
//   node scripts/backlog.cjs snooze T-042 --horas 12 --motivo "…"   # espera a un reloj (no la sugiere `next`)
//   node scripts/backlog.cjs wake T-042                # la despierta antes de tiempo
//   node scripts/backlog.cjs sync                      # importa ids nuevos del markdown
//
// El session-id se resuelve solo: --sid > .session-id > CLAUDE_CODE_SESSION_ID.
'use strict';
const fs = require('fs');
const { marcarDesplegado } = require('../lib/backlog/marcaDesplegado.cjs');
const path = require('path');
// Driver perezoso y por resolucion normal: una ruta ABSOLUTA/cableada rompe el script
// en CI y en cualquier maquina que no sea la de Manuel. `postgres` esta en la raiz.
const loadPg = () => require('postgres');
// La decisión de si una tarea se puede coger vive en un solo sitio, compartida con los tests.
const { claimGate, isChronicSnooze, deployWakeReady, isAwaitingVerification, puedeMarcarseVerificada, clasificarEspera, detectarTrabajoPendiente } = require(path.join(__dirname, '..', 'lib', 'backlog', 'claimGate.cjs'));
// El PLAZO («tiene que estar antes de») es lo contrario de snooze («no la cojas antes de»).
const { clasificarPlazo, validarPlazo, tareasConPlazo } = require(path.join(__dirname, '..', 'lib', 'backlog', 'plazo.cjs'));

const LEASE_MIN = 90;                 // duración del lease; heartbeat lo renueva
const REPO = path.join(__dirname, '..');
const MD_REL = path.join('docs', 'roadmap', 'tareas-pendientes.md');
const MD = path.join(REPO, MD_REL);

/**
 * ¿La ficha de este id ESTUVO alguna vez en el markdown? Es la prueba que separa «me la han
 * borrado» (regresión) de «otra sesión no ha pusheado la suya» (normal con 2-10 sesiones).
 *
 * FAIL-OPEN a `false` a propósito, igual que el push-guard hace con la BD: si git no puede
 * contestar (no es un repo, el fichero se renombró, cualquier avería), lo que NO se puede hacer es
 * inventarse una regresión y mandar a alguien a buscar una ficha que nunca existió. Un aviso que
 * miente una vez deja de leerse para siempre.
 */
// Los hechos de git sobre una ficha viven en su propio módulo (T-427): con el `cwd` inyectado se
// pueden ejercitar contra un repositorio de prueba que reproduzca el incidente. Estaban aquí dentro,
// y por eso el punto ciego de «solo miro mi rama» sobrevivió a tener tests: lo testeable era la
// decisión, no los datos con los que se decide.
//
// ⚠️ RESTAURADO el 31/07: el commit `6f3e26261` (T-441, otra sesión) subió una copia rancia de este
// fichero y se llevó por delante todo este cableado — `lib/backlog/gitFichas.cjs` y sus tests
// seguían en `main` pero ya no los llamaba nadie, o sea el arreglo VIVO pero INERTE. Es el mismo
// fallo que describe [T-428] y que este subsistema existe para cazar, cometido sobre CÓDIGO en vez
// de sobre una ficha. Si vuelves a tocar este bloque, mira antes `git log -p` del fichero.
const {
  estuvoEnElHistorialLocal, hechosDeOrigin, enAlgunaRama, commitQueLaQuito, refrescarOrigin,
} = require(path.join(__dirname, '..', 'lib', 'backlog', 'gitFichas.cjs'));
const GIT_FICHAS = { cwd: REPO, mdRel: MD_REL };

/** Envoltorio del historial LOCAL. Se conserva el nombre porque hay otros llamadores (T-441). */
function estuvoEnElHistorial(id) {
  // Delegado: los hechos de git viven en `lib/backlog/gitFichas.cjs` y NO se reimplementan aquí.
  // Tener dos lectores con criterios distintos es como nació el punto ciego que costó las cinco
  // fichas del 31/07 — y como nacieron las seis copias del session-id de T-407.
  return estuvoEnElHistorialLocal(id, GIT_FICHAS);
}

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0) return null;
  const v = process.argv[i + 1];
  // Un flag sin valor seguido de otro flag devolvía el FLAG como valor: `--tras-deploy
  // --superficie frontend` guardaba el sha "--superficie" (visto en la prueba real, 29/07).
  return v == null || v.startsWith('--') ? null : v;
}
// La identidad de la sesión se resuelve en UN solo sitio (T-407): había seis copias de esto
// con dos reglas distintas, y una sesión llegaba a verse a sí misma como ajena.
const { resolverSid } = require(path.join(REPO, 'lib', 'sessions', 'sid.cjs'));

/**
 * Deja constancia de un roce en el bus de fricción de [T-423]. Detached y en silencio: nada de
 * esto puede añadir latencia ni tumbar un comando del backlog.
 *
 * Se registran las DOS caras del gate de verificación —cuándo para y cuándo se rodea con
 * `--igualmente`—, porque el ratio entre ambas es lo que dice si sigue vivo o si se ha convertido
 * en un peaje que todo el mundo esquiva.
 */
function friccion(clase, guard, detalle) {
  try {
    const a = ['--clase', clase, '--guard', guard];
    if (detalle) a.push('--detalle', String(detalle).slice(0, 200));
    require('child_process')
      .spawn(process.execPath, [path.join(REPO, 'scripts', 'friccion-emitir.cjs'), ...a], { detached: true, stdio: 'ignore' })
      .unref();
  } catch { /* la telemetría nunca estorba */ }
}

const cmd = process.argv[2];
const sid = resolverSid({ repo: REPO }).sid;
const s = loadPg()(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });

// 'ninguna' = APARCADA por tamaño/coste (decisión Manuel 20/07 para T-040, ~21.000
// preguntas). No es "muy baja": es que NO entra en el reparto — `next` no la sugiere
// nunca y en `list` sale la última. Se coge solo a propósito, cuando haya presupuesto.
const EMOJI = { critica: '🔴', alta: '🟠', media: '🟡', baja: '🟢', ninguna: '⬜' };
const age = (t) => {
  if (!t) return '';
  const m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`;
};
const left = (t) => {
  if (!t) return '';
  const m = Math.round((new Date(t).getTime() - Date.now()) / 60000);
  return m > 0 ? `${m}m` : 'caducado';
};
// 'sáb 04:00' — lo que necesita saber la sesión que la ve en `list` (hora local, no ISO).
const cuando = (t) => new Date(t).toLocaleString('es-ES', {
  weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});
const dormida = (r) => r.snooze_until && new Date(r.snooze_until) > new Date();
// Esperar a un deploy es esperar igual: `next` no la sugiere y `claim` no la entrega.
const esperandoDeploy = (r) => !!r.wake_on_deploy_sha;
// La QUINTA espera cuenta como espera para TODO lo que ordena o sugiere trabajo (T-539): si no,
// `next` ofrecería una tarea ya entregada y alguien reharía lo que está pendiente de revisar.
const enEsperaAlguna = (r) => dormida(r) || esperandoDeploy(r) || REV.esperaRevision(r);

/**
 * Momento hasta el que aplazar, desde --hasta/--horas/--dias. Devuelve Date o lanza.
 * `--hasta` acepta ISO ('2026-07-29T04:00Z') o 'YYYY-MM-DD HH:MM' local.
 */
function parseHasta() {
  const hasta = arg('--hasta') || arg('--until');
  const horas = arg('--horas');
  const dias = arg('--dias');
  if (hasta) {
    const d = new Date(hasta.includes('T') || hasta.includes(' ') ? hasta : `${hasta}T00:00`);
    if (isNaN(d.getTime())) throw new Error(`--hasta no es una fecha válida: ${hasta}`);
    return d;
  }
  if (horas) return new Date(Date.now() + Number(horas) * 3600_000);
  if (dias) return new Date(Date.now() + Number(dias) * 86400_000);
  throw new Error('falta el plazo: usa --hasta <ISO|YYYY-MM-DD HH:MM> | --horas N | --dias N');
}
function needSid() {
  if (!sid) { console.error('❌ sin session-id: usa --sid <ID> o crea un fichero .session-id'); process.exit(2); }
}

/**
 * Lo que hay que hacer ANTES de empezar, impreso al reclamar (T-433).
 *
 * ── POR QUÉ NO BASTA CON TENERLO ESCRITO ─────────────────────────────────────────────────────
 * Esta exigencia —no chapuzas, integrar en vez de crear silos, capas de seguridad— lleva tiempo
 * en CLAUDE.md, y aun así hay que repetirla a mano cada poco. El motivo no es desidia: CLAUDE.md
 * se lee UNA VEZ al arrancar la sesión, y cuando media hora después se coge una tarea, esas
 * líneas están sepultadas bajo doscientas. **Una regla que vive donde nadie mira en el momento
 * de la verdad no se cumple.**
 *
 * Y los guardarraíles que ya existen actúan TARDE: `robustez-push-guard` exige capas al pushear
 * —con el trabajo ya hecho— y los registros de herramientas y runbooks avisan en CI. Ninguno
 * puede devolverte las dos horas que pasaste construyendo algo que ya existía.
 *
 * `claim` es el único punto por el que pasa TODA tarea justo antes de empezar. Por eso el
 * recordatorio va aquí y no en otro sitio.
 *
 * ── POR QUÉ ES CONTEXTUAL Y CORTO ────────────────────────────────────────────────────────────
 * Cinco líneas y con el comando de búsqueda YA ESCRITO con las palabras de esta tarea. Un bloque
 * largo y genérico se convierte en papel pintado a la tercera vez que sale: se salta con la
 * vista, exactamente igual que se saltaba el aviso de CLAUDE.md.
 */
function recordarComoSeTrabaja(titulo) {
  // Palabras con las que buscar si esto YA existe: las significativas del título, sin relleno.
  const PARADAS = new Set(['para', 'como', 'desde', 'hasta', 'sobre', 'entre', 'cuando', 'donde',
    'este', 'esta', 'esto', 'todo', 'toda', 'pero', 'porque', 'sin', 'con', 'que', 'los', 'las',
    'del', 'una', 'uno', 'por', 'más', 'mas', 'son', 'está', 'esta', 'hay', 'sus', 'ese', 'esa']);
  const claves = String(titulo || '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]+/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !PARADAS.has(w))
    .slice(0, 3);

  console.log('\n📐 ANTES DE ESCRIBIR CÓDIGO — el orden que evita rehacer trabajo:');
  console.log(`   1. ¿ya existe?     npm run tools:buscar -- ${claves.join(' ') || '<palabra>'}`);
  console.log('   2. ¿dónde encaja?  intégralo en el runbook/sistema que ya lo cubre — nada de silos');
  console.log('   3. capas          unit · integración · simulación · canary · guardarraíl — SOLO las que hagan falta');
  console.log('   4. si toca UI     vence-sim (playwright) ya está montado');
  console.log('   (el pre-push EXIGE al menos una capa; llegar ahí sin ninguna es rehacer el trabajo)');
}

/**
 * Al retomar una tarea, enseña lo que dejó la sesión ANTERIOR sin pushear (T-430).
 *
 * Cuando una sesión muere de golpe —se apaga el ordenador, se queda sin contexto, la cierran— no
 * llega a escribir el `--hecho`/`--falta` del `pause`: ese hueco solo lo llena quien tiene la
 * oportunidad de despedirse, y justo las que mueren no la tienen.
 *
 * Pero su worktree conserva el trabajo, y **los mensajes de sus commits sin pushear son la mejor
 * nota que existe**: se escribieron cuando esa sesión tenía todo el contexto y no costaron ni un
 * gramo de disciplina extra. Pedir notas periódicas habría decaído como decae todo lo que depende
 * de acordarse; esto se deriva de lo que git ya guardó.
 *
 * Solo informa, y es fail-open: no puede impedir coger una tarea.
 */
async function ofrecerTrabajoDeLaSesionAnterior(s, sidAnterior) {
  if (!sidAnterior) return;
  try {
    const [ses] = await s`
      SELECT slug, worktree_path, last_signal_at FROM public.worktree_sessions WHERE sid = ${sidAnterior}`;
    if (!ses || !ses.worktree_path || !fs.existsSync(ses.worktree_path)) return;
    const { execFileSync } = require('child_process');
    const git = (a) => { try { return execFileSync('git', a, { cwd: ses.worktree_path, encoding: 'utf8', stdio: ['ignore','pipe','ignore'], timeout: 6000 }).trim(); } catch { return ''; } };
    const sucios = git(['status', '--porcelain', '--untracked-files=no']).split('\n').filter(Boolean);
    const commits = git(['log', 'origin/main..HEAD', '--format=%h %s', '-8']).split('\n').filter(Boolean);
    if (!sucios.length && !commits.length) return;
    const min = ses.last_signal_at ? Math.round((Date.now() - new Date(ses.last_signal_at).getTime()) / 60000) : null;
    console.log(`\n📦 LA SESIÓN ANTERIOR (${ses.slug}${min != null ? `, sin señal desde hace ${min} min` : ''}) DEJÓ TRABAJO SIN PUSHEAR:`);
    console.log(`   ${ses.worktree_path}`);
    if (commits.length) {
      console.log(`   ${commits.length} commit(s) sin pushear — sus mensajes son lo más parecido a sus notas:`);
      for (const c of commits) console.log(`      ${c.slice(0, 96)}`);
    }
    if (sucios.length) {
      console.log(`   ${sucios.length} fichero(s) sin commitear:`);
      for (const f of sucios.slice(0, 8)) console.log(`      ${f}`);
      if (sucios.length > 8) console.log(`      …y ${sucios.length - 8} más`);
    }
    console.log('   Míralo antes de empezar de cero — puede estar medio hecho.');
  } catch { /* informar no puede impedir reclamar */ }
}

/**
 * Al RECLAMAR, avisa si otra sesión viva ya está tocando los ficheros de esta tarea (T-400).
 *
 * El claim protege el id de la tarea; las sesiones chocan por los FICHEROS. Casos medidos: T-361
 * (mismo bug encontrado por dos sesiones el mismo día), T-130 (quinto escritor de seguimiento_url
 * sin ver los otros cuatro) y T-375/T-382, cogidas por separado y resultando los mismos ficheros.
 *
 * Se AVISA, nunca se bloquea: dos sesiones pueden tocar un fichero por motivos legítimos, y un
 * corte por solape se acabaría rodeando (la lección de T-375, donde el bloqueo imposible enseñaba
 * a apagar el guard entero). Y es fail-open total: esto no puede impedir coger una tarea.
 */
async function avisarSolape(s, id, ficha) {
  try {
    const { ficherosProbablesDeFicha, calcularSolapes, sesionesSinHuella } =
      require(path.join(REPO, 'lib', 'sessions', 'solape.cjs'));
    const { execFileSync } = require('child_process');
    // Dos fuentes: lo que ya movieron los commits de esta tarea + las rutas citadas en su ficha
    // (lo único que hay si la tarea es nueva).
    let deCommits = [];
    try {
      deCommits = execFileSync('git', ['log', '--grep', id, '--name-only', '--format=', '-30'],
        { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 6000 })
        .split('\n').map((l) => l.trim()).filter(Boolean);
    } catch { /* sin git no hay predicción por commits */ }
    const probables = [...new Set([...deCommits, ...ficherosProbablesDeFicha(ficha)])];
    if (!probables.length) return;

    const sesiones = await s`
      SELECT sid, slug, worktree_path, touched_files, last_signal_at FROM public.worktree_sessions`;

    // Las sesiones que comparten MI directorio se excluyen del solape por ficheros, y no es una
    // excepción de conveniencia: comparten árbol, así que su huella son LITERALMENTE mis mismos
    // ficheros sucios. El aviso sería tautológico y encima mal atribuido — «otra sesión toca
    // scripts/backlog.cjs» cuando quien lo estaba tocando era yo. (Saltó en el primer uso real,
    // reclamando T-385.) Ese problema es más grave y se reporta aparte, arriba: `latidos.cjs` lo
    // canta como «varias sesiones en el mismo checkout», que es lo accionable.
    const miPath = (sesiones.find((x) => x.sid === sid) || {}).worktree_path || null;
    const ajenas = miPath ? sesiones.filter((x) => x.worktree_path !== miPath) : sesiones;
    const compartiendo = sesiones.length - ajenas.length - (miPath ? 1 : 0);
    if (compartiendo > 0) {
      console.log(`\n🚨 ${compartiendo} sesión(es) más trabajan en TU MISMO directorio (${miPath}).`);
      console.log('   No puedo distinguir sus cambios de los tuyos: lo sano es un worktree por sesión.');
    }
    const solapes = calcularSolapes({ misFicheros: probables, sesiones: ajenas, sid });
    if (solapes.length) {
      console.log(`\n⚠️  OJO — otra(s) sesión(es) VIVA(s) están tocando ficheros de ${id}:`);
      for (const c of solapes) {
        console.log(`   · ${c.slug} (señal hace ${c.minutos} min) — ${c.ficheros.length} fichero(s) en común:`);
        for (const f of c.ficheros.slice(0, 6)) console.log(`       ${f}`);
        if (c.ficheros.length > 6) console.log(`       …y ${c.ficheros.length - 6} más`);
      }
      console.log('   No bloquea: decide tú si coordinas, esperas o vais por sitios distintos.');
    }
    const ciegas = sesionesSinHuella(ajenas, sid);
    if (ciegas.length && solapes.length === 0) {
      // Decir "no hay solape" cuando hay sesiones que no publican huella sería un verde falso.
      console.log(`\nℹ️  ${ciegas.length} sesión(es) viva(s) sin huella publicada: no puedo descartar solape con ellas.`);
    }
  } catch { /* fail-open: un aviso roto no puede impedir reclamar */ }
}

/**
 * Al reclamar, enseña las tareas RELACIONADAS que están libres (T-414).
 *
 * No hace falta un campo nuevo: las fichas ya se cruzan entre sí con `[T-nnn]` en la prosa
 * («Relacionadas: …», «el fallo que lo motivó», «gemelo de…»), y ese dato no lo usaba nadie.
 * Derivarlo es infinitamente mejor que pedirlo: un campo que hay que rellenar a mano se queda
 * vacío o miente, y aquí el enlace lo escribe quien de verdad sabe que existe, mientras escribe.
 *
 * Por qué importa: el contexto es lo caro. Si acabas de leerte el detector de scope, la SIGUIENTE
 * tarea de scope te cuesta la mitad — y hoy eso dependía de que alguien se acordara de mirar.
 * Se muestran solo las VIVAS y LIBRES: enseñar cerradas o ajenas es ruido.
 */
async function sugerirRelacionadas(s, id, ficha) {
  try {
    const ids = [...new Set([...String(ficha || '').matchAll(/\bT-\d{3}\b/g)].map((m) => m[0]))]
      .filter((x) => x !== id);
    if (!ids.length) return;
    const rows = await s`
      SELECT id, title, priority, effort, claimed_by, lease_until, status
        FROM public.backlog_tasks
       WHERE id IN ${s(ids)} AND status IN ('open','in_progress','blocked')`;
    const libres = rows.filter((r) => !r.claimed_by || (r.lease_until && new Date(r.lease_until) < new Date()));
    if (!libres.length) return false;
    console.log(`\n🔗 ${libres.length} tarea(s) RELACIONADA(s) y libres — el contexto que acabas de cargar sirve para ellas:`);
    for (const r of libres.slice(0, 6)) {
      const esf = r.effort ? ` · ${r.effort}` : '';
      console.log(`   ${EMOJI[r.priority] || ' '} ${r.id}${esf}  ${String(r.title).slice(0, 66)}`);
    }
    return true;
  } catch { return false; /* una sugerencia rota no puede estorbar un claim */ }
}

/**
 * AL CERRAR, SIEMPRE SE SUGIERE ALGO. (T-498)
 *
 * Regla de Manuel (03/08): *«siempre que las sesiones terminen una tarea deben sugerir coger otra
 * relacionada para aprovechar el contexto que tienen; si no hay ninguna, sugerir otra, pero
 * siempre hay que sugerir cosas y ser proactivo»*.
 *
 * Hasta hoy `claim` sugería relacionadas y `done` **no sugería nada**, que es justo el momento en
 * que el contexto está más cargado y a punto de tirarse: acabas de leerte un subsistema entero.
 * Es el principio 10 del sistema de sesiones —la regla tiene que llegar en el MOMENTO DE LA
 * VERDAD— aplicado al final en vez de al principio.
 *
 * Dos escalones, y el segundo es el que hace que NUNCA se quede en silencio:
 *   1. las RELACIONADAS que cita la propia ficha (contexto compartido, cuestan la mitad);
 *   2. si no hay ninguna libre, la que propondría `next` — mismo criterio, sin duplicarlo.
 */
async function sugerirSiguiente(s, id, sid) {
  try {
    if (await sugerirRelacionadas(s, id, fichaBody(id))) {
      console.log('   (cógela con `claim <id>`: imprime la ficha entera)');
      return;
    }
    const rows = await s`
      SELECT id, title, priority, status, claimed_by, lease_until, blocked_by, snooze_until,
             wake_on_deploy_sha, effort, resume_check,
             review_requested_at, review_note, review_requested_by
        FROM public.backlog_tasks WHERE status IN ('open','in_progress','blocked')`;
    // MISMO criterio que `next`, no una copia (T-130): vive en lib/backlog/orden.cjs.
    const libre = ORDEN.candidatas(rows, {
      sid, excluir: [id], enEspera: enEsperaAlguna, pesoEsfuerzo: ESF.pesoEsfuerzo,
    });
    if (!libre.length) { console.log('\n🎉 no hay ninguna tarea libre que sugerir — el backlog está al día.'); return; }
    console.log('\n➡️  NINGUNA relacionada libre. Lo siguiente por prioridad y esfuerzo:');
    for (const r of libre.slice(0, 3)) {
      const esf = r.effort ? ` · ${r.effort}` : '';
      console.log(`   ${EMOJI[r.priority] || ' '} ${r.id}${esf}  ${String(r.title).slice(0, 66)}`);
    }
    console.log('   (`next` explica el criterio completo; `claim <id>` la coge)');
  } catch { /* sugerir NUNCA puede estropear un cierre ya hecho */ }
}

// Cuerpo de la ficha de una tarea: desde su cabecera `### [T-xxx]` hasta la siguiente `###`.
// Lo usa `claim` para que reclamar imprima el detalle (reclamar = leer).
function fichaBody(id) {
  const md = fs.readFileSync(MD, 'utf8').split('\n');
  const start = md.findIndex((l) => new RegExp(`^###\\s+.*\\[${id.replace('-', '\\-')}\\]`).test(l));
  if (start < 0) return null;
  let end = start + 1;
  while (end < md.length && !/^###\s+/.test(md[end])) end++;
  return md.slice(start, end).join('\n').trim();
}

// Parseo del markdown: la implementación es COMPARTIDA con lib/backlog/claim.ts. Ver el porqué
// (y el cambio de criterio de "abierta") en lib/backlog/parseMarkdown.cjs.
const { parseBacklogMarkdown } = require(path.join(REPO, 'lib', 'backlog', 'parseMarkdown.cjs'));
// Esfuerzo declarado en cajones + contraste con lo que costó de verdad (T-414).
const ESF = require(path.join(REPO, 'lib', 'backlog', 'esfuerzo.cjs'));
// El embudo de preguntas a Manuel (T-493). El juicio —qué es contestable, en qué orden, qué
// respuestas tiene que ver una sesión— vive en el núcleo puro, no aquí.
const PREG = require(path.join(REPO, 'lib', 'backlog', 'preguntas.cjs'));
const REV = require(path.join(REPO, 'lib', 'backlog', 'revision.cjs'));
// Qué tarea toca ahora: criterio ÚNICO, compartido por `next` y por la sugerencia de `done`.
const ORDEN = require(path.join(REPO, 'lib', 'backlog', 'orden.cjs'));
// El recordatorio de método: qué recordar y CUÁNDO (T-495). Momentos, nunca un temporizador.
const RECORDATORIO = require(path.join(REPO, 'lib', 'sessions', 'recordatorio.cjs'));

function parseMd() {
  return parseBacklogMarkdown(fs.readFileSync(MD, 'utf8')).map((t) => ({
    ...t,
    // El núcleo devuelve `null` cuando la cabecera no lleva emoji de prioridad; aquí hace falta
    // un valor concreto porque esta columna se ESCRIBE en la BD. ⬜ = aparcada a propósito.
    priority: t.parked ? 'ninguna' : (t.priority ?? 'media'),
  }));
}

/**
 * Despierta las tareas cuyo commit YA está vivo, dado el sha de cada superficie.
 *
 * Una sola implementación para los DOS caminos que la necesitan:
 *   · `deployed <sha>` — lo llama el script de deploy al terminar (push);
 *   · la reconciliación perezosa de `list` — mira el sha vivo de `/health` (pull).
 *
 * Existe el segundo camino porque el primero tiene una dependencia oculta que falló en su
 * estreno (29/07): cada sesión despliega DESDE SU PROPIO WORKTREE, que puede ser de hace días.
 * La sesión que desplegó esa noche tenía un `deploy-frontend.sh` anterior al commit que añadió
 * la llamada, así que el deploy salió bien y NO avisó a nadie: T-266 se quedó esperando un
 * frontend que ya estaba vivo. Fallo silencioso —sin error, solo ausencia—, que es justo lo que
 * este mecanismo venía a evitar. Reconciliar contra el sha VIVO no depende de quién desplegó ni
 * con qué script, y seguiría funcionando si mañana despliega GitHub Actions u otro proveedor.
 *
 * `contiene` se resuelve con `merge-base --is-ancestor`: el commit esperado tiene que estar
 * CONTENIDO en el desplegado, no ser igual — el deploy es cumulativo y sube todo `main`.
 *
 * @param {*} s cliente sql
 * @param {{frontend?:string|null, backend?:string|null}} shas sha vivo por superficie (null = no se sabe)
 * @param {{verboso?:boolean}} [opts]
 */
async function despertarPorDeploy(s, shas, opts = {}) {
  const esperando = await s`
    SELECT id, title, wake_on_deploy_sha, wake_on_deploy_surface, resume_check
      FROM public.backlog_tasks
     WHERE wake_on_deploy_sha IS NOT NULL AND status IN ('open','in_progress','blocked')`;
  if (!esperando.length) return { esperaban: 0, despertadas: 0, ids: [] };

  const { execFileSync } = require('child_process');
  const contenidoEn = (base, sha) => {
    if (!sha) return false;   // "no lo sé" NUNCA despierta: sería mandar a verificar algo que no está vivo
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', base, sha], { cwd: REPO, stdio: 'ignore' });
      return true;
    } catch { return false; } // fail-safe: si git no puede contestar (commit purgado), no se despierta
  };

  const ids = [];
  for (const t of esperando) {
    const contiene = {
      frontend: contenidoEn(t.wake_on_deploy_sha, shas.frontend),
      backend: contenidoEn(t.wake_on_deploy_sha, shas.backend),
    };
    if (!deployWakeReady(t, contiene)) continue;
    // El pendiente escrito a mano suele decir «1) Desplegar FRONTEND…», y limpiar solo la
    // columna dejaba ese texto mintiendo para siempre: en `list` una tarea ya desplegada y una
    // bloqueada se veían IDÉNTICAS ([T-463]; medido: 10 de 10 tareas que decían «desplegar» ya
    // estaban vivas, 3 de ellas críticas). Se ANTEPONE una marca, nunca se borra texto ajeno.
    const shaDesplegado = contiene.frontend ? shas.frontend : shas.backend;
    const marcado = marcarDesplegado(t.resume_check, shaDesplegado);
    await s`UPDATE public.backlog_tasks
               SET wake_on_deploy_sha = NULL, wake_on_deploy_surface = NULL
                 , resume_check = COALESCE(${marcado}, resume_check)
             WHERE id = ${t.id}`;
    ids.push(t.id);
    if (opts.verboso) console.log(`⏰ ${t.id} DESPERTADA — ya se puede verificar: ${marcado || t.resume_check || t.title}`);
    // El aviso no puede morir en el log de quien desplegó: quien pausó la tarea es otra sesión,
    // que no lo ve. Rastro en `observable_events`, el bus que ya usa todo el proyecto.
    try {
      await s`
        INSERT INTO public.observable_events (source, severity, event_type, endpoint, error_message, metadata)
        VALUES ('fargate', 'info', 'backlog_task_awakened', 'backlog',
                ${`${t.id} lista para verificar tras desplegar`},
                ${s.json({
                  task: t.id,
                  surface: t.wake_on_deploy_surface || 'both',
                  frontend: shas.frontend || null,
                  backend: shas.backend || null,
                  check: t.resume_check || null,
                })})`;
    } catch { /* el aviso es un extra, no una precondición del deploy */ }
  }
  return { esperaban: esperando.length, despertadas: ids.length, ids };
}

(async () => {
  // LATIDO (T-296): este script se invoca constantemente y ya resuelve el `sid` solo, así que es el
  // sitio natural para dejar constancia de que esta sesión está viva — el dato que faltaba para
  // poder contestar «¿puedo borrar este worktree?» sin conjeturas. Va en subproceso DETACHED y sin
  // esperarlo: la telemetría no puede añadir latencia ni, sobre todo, poder fallar y tumbar un
  // `claim`. Si no late, se pierde una señal; si bloqueara, alguien dejaría de usar el backlog.
  try {
    const { spawn } = require('child_process');
    const hijo = spawn(process.execPath, [path.join(__dirname, 'sessions', 'latir.cjs'), '--cmd', String(cmd || '')],
      { detached: true, stdio: 'ignore' });
    hijo.unref();
  } catch { /* sin latido se sigue trabajando igual */ }

  // ── EL CAMINO DE VUELTA DE UNA RESPUESTA (T-493) ─────────────────────────────────────────
  // Va aquí, antes de cualquier comando, por el mismo motivo que el latido: la sesión invoca este
  // CLI constantemente, así que **trabajar es enterarse** y nadie tiene que acordarse de mirar
  // una bandeja. Se marca `seen_at` al imprimirlo para que salga UNA vez: un aviso que se repite
  // para siempre se vuelve indistinguible del ruido, que es como mueren los avisos de este repo.
  //
  // Fail-open: si la tabla aún no existe (migración sin aplicar) o la consulta falla, se calla.
  // Una avería del embudo no puede impedir reclamar una tarea.
  try {
    if (sid) {
      const pendientes = await s`
        SELECT id, task_id, question, answer, sid, status, seen_at
          FROM public.session_questions
         WHERE sid = ${sid} AND status = 'answered' AND seen_at IS NULL
         ORDER BY answered_at`;
      const sinLeer = PREG.respuestasSinLeer(pendientes, sid);
      if (sinLeer.length) {
        console.log(`\n📬 ${sinLeer.length} RESPUESTA(S) DE MANUEL a lo que preguntaste:`);
        for (const p of sinLeer) {
          console.log(`   #${p.id}${p.task_id ? ` · ${p.task_id}` : ''}  ${String(p.question).replace(/\s+/g, ' ').slice(0, 100)}`);
          console.log(`   → ${p.answer}`);
        }
        console.log('');
        await s`UPDATE public.session_questions SET seen_at = now() WHERE id IN ${s(sinLeer.map((p) => p.id))}`;
      }
    }
  } catch { /* sin embudo se sigue trabajando igual */ }

  try {
    if (cmd === 'list') {
      const all = process.argv.includes('--all');
      // RECONCILIACIÓN PEREZOSA. No se puede depender de que quien despliega avise: cada sesión
      // despliega desde su propio worktree y el suyo puede ser anterior al commit que añadió esa
      // llamada — pasó el 29/07 y T-266 se quedó esperando un frontend que ya estaba vivo, sin
      // un solo error de por medio. Aquí se mira el sha VIVO y se despierta lo que ya está dentro.
      // Coste CERO cuando no hay nada esperando: si la consulta no devuelve tareas, ni se toca la red.
      const pendientesDeDeploy = await s`
        SELECT count(*)::int n FROM public.backlog_tasks
         WHERE wake_on_deploy_sha IS NOT NULL AND status IN ('open','in_progress','blocked')`;
      if (pendientesDeDeploy[0]?.n > 0) {
        try {
          const { shasVivos } = require(path.join(__dirname, '..', 'lib', 'deploy', 'shaVivo.cjs'));
          const r = await despertarPorDeploy(s, await shasVivos(), { verboso: false });
          if (r.despertadas) console.log(`\n⏰ ${r.ids.join(', ')} — el deploy ya está vivo: pasan a LISTA(S) PARA VERIFICAR`);
        } catch { /* fail-open: sin red o sin git, `list` sigue funcionando como siempre */ }
      }
      const rows = await s`
        SELECT id, title, priority, status, claimed_by, claimed_at, lease_until, blocked_by,
               snooze_until, snooze_reason, snooze_count, resume_check, due_at, due_reason,
               wake_on_deploy_sha, wake_on_deploy_surface, effort,
               review_requested_at, review_note, review_requested_by
          FROM public.backlog_tasks
         ${all ? s`` : s`WHERE status IN ('open','in_progress','blocked')`}
         ORDER BY CASE priority WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baja' THEN 3 ELSE 9 END,
                  -- A igualdad de prioridad, lo más CORTO primero (T-414). Lo no declarado va al
                  -- final: no se puede afirmar que algo sea rápido si nadie lo ha mirado, y
                  -- colarlo delante llenaría la cabeza de la lista de tareas que no se cierran.
                  CASE effort WHEN 'minutos' THEN 0 WHEN 'rato' THEN 1 WHEN 'larga' THEN 2 WHEN 'sesion_propia' THEN 3 ELSE 9 END,
                  id`;
      // LO PRIMERO que se ve al pedir las tareas pendientes: lo que se puede cerrar YA.
      // Antes salía al final, detrás de 100+ líneas, y por eso T-273 llevaba 16 h esperando y
      // T-270 estaba perdiendo su ventana de medición sin que nadie lo supiera (30/07).
      // Se separan dos cosas que se atienden distinto: lo que verificamos nosotros y lo que
      // espera una decisión de Manuel — que por muy despierta que esté, Claude no puede cerrar.
      // LO PRIMERO DE LO PRIMERO: lo que CADUCA. Una tarea que se cierra rápido se cierra igual
      // mañana; una con plazo, no — pasada la fecha el trabajo no se retrasa, se pierde o se
      // vuelve dañino (T-330: una newsletter que el 1 de agosto habría anunciado un plazo ya
      // cerrado). Por eso va por encima incluso de las listas para verificar.
      const conPlazo = tareasConPlazo(rows, new Date());
      if (conPlazo.length) {
        const urgentes = conPlazo.filter((r) => r.plazo.peso <= 2);
        console.log(`\n${urgentes.length ? '🔥' : '📅'} ${conPlazo.length} CON FECHA LÍMITE${urgentes.length ? ` — ${urgentes.length} vence(n) ya` : ''}:`);
        for (const r of conPlazo) {
          const p = r.plazo;
          const cuanto = p.banda === 'vencida' ? `VENCIÓ hace ${-p.dias} día(s)` : p.banda === 'hoy' ? 'VENCE HOY' : `en ${p.dias} día(s)`;
          console.log(`   ${p.icono} ${r.id}  ${String(r.title).slice(0, 52).padEnd(54)} ${cuanto}`);
          console.log(`      ▶ ${String(r.due_reason || '').slice(0, 150)}`);
        }
      }
      const listas = rows.filter((r) => isAwaitingVerification(r));
      const paraVerificar = listas.filter((r) => REV.clasificarEsperaTarea(r, clasificarEspera) === 'verificacion');
      const paraManuel = listas.filter((r) => REV.clasificarEsperaTarea(r, clasificarEspera) === 'decision');
      // ENTREGADAS: la quinta espera, y esta sí es un CAMPO, no una redacción afortunada (T-539).
      // Se sacan de `rows` y no de `listas` porque `isAwaitingVerification` exige `resume_check`,
      // y una entrega no tiene por qué haber pasado por `pause`.
      const entregadas = rows.filter((r) => REV.esperaRevision(r));
      if (paraVerificar.length) {
        // NO decir «se cierran rápido» (lo decía hasta el 31/07): empuja justo a lo contrario de
        // lo que toca. Estas tareas están IMPLEMENTADAS y sin comprobar; lo que falta no es
        // teclear `done`, es ir a mirar producción. Con la frase anterior, el atajo mental era
        // cerrarlas — y así es como una tarea se da por buena sin que nadie haya verificado nada,
        // que es el fallo que motivó [T-392].
        console.log(`\n⏰ ${paraVerificar.length} IMPLEMENTADA(S) Y SIN COMPROBAR — hay que MIRAR producción antes de cerrarlas:`);
        for (const r of paraVerificar) {
          console.log(`   ${r.id}  ${String(r.title).slice(0, 60)}`);
          console.log(`      ▶ falta: ${String(r.resume_check).slice(0, 160)}`);
        }
        console.log('   (cógelas con `claim <id>`: imprime dónde se dejaron)');
      }
      // ── EL EMBUDO, LO PRIMERO (T-493) ─────────────────────────────────────────────────
      // Va por delante incluso de las listas para verificar: una pregunta abierta puede tener a
      // una sesión parada AHORA, y ese coste corre mientras nadie la lee.
      try {
        const abiertas = await s`
          SELECT id, sid, task_id, question, context, blocking, asked_at, status
            FROM public.session_questions WHERE status = 'open'`;
        for (const l of PREG.formatearEmbudo(abiertas)) console.log(l);
      } catch { /* sin embudo, el resto del listado sigue igual */ }

      // ── ENTREGADAS Y ESPERANDO REVISIÓN (T-539) ──────────────────────────────────────
      // Van pegadas al embudo porque son lo mismo desde el punto de vista de Manuel: trabajo
      // parado esperando que él mire. La diferencia es que aquí YA HAY entregable.
      if (entregadas.length) {
        console.log(`\n🙋 ${entregadas.length} ENTREGADA(S) — hechas y esperando que las revises:`);
        for (const r of entregadas) console.log(REV.lineaRevision(r));
        console.log(`   (al aprobarla: 'wake <id>' la devuelve al pool; nadie la coge sin --force)`);
      }

      if (paraManuel.length) {
        // LEGACY (T-493): esto se DEDUCE de la prosa de `resume_check` con cinco expresiones
        // regulares, así que solo ve las tareas PAUSADAS y solo si alguien escribió la palabra
        // correcta. El canal de verdad es el embudo de arriba; esto se queda mientras queden
        // tareas pausadas con la fórmula vieja, y NO debe crecer: preguntar va por `preguntar`.
        console.log(`\n🙋 ${paraManuel.length} ESPERANDO UNA DECISIÓN DE MANUEL (por texto de pausa) — no se pueden cerrar solas:`);
        for (const r of paraManuel) {
          console.log(`   ${r.id}  ${String(r.title).slice(0, 60)}`);
          console.log(`      ▶ decide: ${String(r.resume_check).slice(0, 160)}`);
        }
      }
      console.log(`\nBACKLOG — ${rows.length} tarea(s)${all ? ' (todas)' : ' abiertas'}:\n`);
      let enEspera = 0;
      for (const r of rows) {
        const vivo = r.lease_until && new Date(r.lease_until) > new Date();
        // El aplazamiento se pinta ANTES que "libre": libre-pero-dormida se leía como
        // "cógela", que es justo el malentendido que esto viene a quitar.
        const lock = esperandoDeploy(r) ? (enEspera++, `🚀 espera deploy de ${String(r.wake_on_deploy_sha).slice(0, 8)}${r.wake_on_deploy_surface && r.wake_on_deploy_surface !== 'both' ? ` (${r.wake_on_deploy_surface})` : ''}`)
                   : dormida(r) ? (enEspera++, `🕒 en espera hasta ${cuando(r.snooze_until)}`)
          : !r.claimed_by ? '🟢 libre'
          : vivo ? `🔒 ${String(r.claimed_by).slice(0, 8)} (${left(r.lease_until)})`
                 : `🟡 lease caducado hace ${age(r.lease_until)} (libre)`;
        const dep = (r.blocked_by || []).length ? ` ⛔ bloqueada por ${r.blocked_by.join(',')}` : '';
        // El esfuerzo se pinta con un icono corto: si no se VE, el campo no cambia ninguna
        // decisión y se deja de rellenar (T-414). El hueco cuenta como «sin declarar».
        const esf = { minutos: '⚡', rato: '◔', larga: '◑', sesion_propia: '⬛' }[r.effort] || ' ';
        console.log(`  ${EMOJI[r.priority]}${esf} ${r.id}  ${String(r.title).slice(0, 57).padEnd(59)} ${r.status.padEnd(12)} ${lock}${dep}`);
        if (dormida(r) && r.snooze_reason) console.log(`         ↳ ${r.snooze_reason}`);
        if (enEsperaAlguna(r) && r.resume_check) console.log(`         ▶ al despertar: ${r.resume_check}`);
        if (isChronicSnooze(r)) console.log(`         🔁 aplazada ${r.snooze_count} veces`);
      }
      // La deuda se hace VISIBLE pero no se exige retroactivamente: `reserve` obliga a las
      // nuevas, y estas se van declarando según se tocan. Obligar de golpe sería una tarde
      // rellenando campos a ojo, que es exactamente cómo se consigue un campo lleno de mentiras.
      const sinEsf = rows.filter((r) => !r.effort).length;
      console.log(`\n  esfuerzo: ⚡ minutos · ◔ un rato · ◑ larga · ⬛ sesión propia · (en blanco) sin declarar${sinEsf ? ` — ${sinEsf} sin declarar` : ''}`);
      if (enEspera) console.log(`\n  🕒 ${enEspera} en espera (no las sugiere \`next\`; se despiertan solas)`);

      console.log('');
    }

    else if (cmd === 'next') {
      const rows = await s`
        SELECT id, title, priority, status, claimed_by, lease_until, blocked_by, snooze_until, snooze_reason,
               wake_on_deploy_sha, effort, review_requested_at, review_note, review_requested_by
          FROM public.backlog_tasks WHERE status IN ('open','in_progress','blocked')`;
      const dormidas = rows.filter(enEsperaAlguna).length;
      // El criterio de «qué toca ahora» es COMPARTIDO con la sugerencia que imprime `done`
      // (T-498): dos copias del mismo juicio acaban contestando distinto a la misma pregunta.
      const libre = ORDEN.candidatas(rows, { sid, enEspera: enEsperaAlguna, pesoEsfuerzo: ESF.pesoEsfuerzo });
      if (dormidas) console.log(`(${dormidas} en espera por reloj — se saltan; \`list\` las muestra con su hora)`);
      // Antes que cualquier tarea nueva, lo que ya está hecho y solo falta comprobar: cuesta
      // minutos, cierra una ficha y libera el backlog. Sin esto se quedaban al fondo de `list`.
      const listasVerificar = rows
        .filter((r) => isAwaitingVerification(r) && clasificarEspera(r.resume_check) === 'verificacion');
      if (listasVerificar.length) {
        const v = listasVerificar[0];
        console.log(`\n⏰ ANTES QUE NADA — ${v.id} está lista para verificar y se cierra rápido:`);
        console.log(`   ${v.title}`);
        console.log(`   ▶ falta: ${String(v.resume_check).slice(0, 200)}`);
        console.log(`   cógela con:  node scripts/backlog.cjs claim ${v.id}`);
        if (listasVerificar.length > 1) console.log(`   (y ${listasVerificar.length - 1} más en \`list\`)`);
      }
      if (!libre.length) { console.log('No hay tareas libres (todas cogidas, bloqueadas o en espera).'); }
      else {
        console.log(`\nSiguiente sugerida: ${EMOJI[libre[0].priority]} ${libre[0].id} — ${libre[0].title}`);
        console.log(`  cógela con:  node scripts/backlog.cjs claim ${libre[0].id}\n`);
      }
    }

    else if (cmd === 'claim') {
      needSid();
      const id = process.argv[3];
      if (!id) { console.error('Uso: backlog.cjs claim <T-xxx>'); process.exit(2); }
      // El reloj y la dependencia son CONDICIÓN, no aviso (29/07). Van dentro del mismo
      // UPDATE atómico que el lease y se evalúan con `now()` del SERVIDOR: con 2-10 sesiones,
      // el reloj de cada portátil no es fuente de verdad. Ver lib/backlog/claimGate.cjs.
      const force = process.argv.includes('--force');
      const forceMotivo = arg('--motivo') || arg('--reason');
      if (force && !forceMotivo) {
        console.error('❌ --force exige --motivo "por qué te saltas la espera/el bloqueo" (queda registrado)');
        process.exit(2);
      }
      // Quién la tuvo ANTES, leído antes de pisarlo: si murió sin pushear, su worktree guarda
      // el contexto que su sesión no llegó a escribir (T-430).
      const [previo] = await s`SELECT last_claimed_by FROM public.backlog_tasks WHERE id = ${id}`;
      const dueñoAnterior = previo && previo.last_claimed_by && previo.last_claimed_by !== sid ? previo.last_claimed_by : null;
      const [row] = await s`
        UPDATE public.backlog_tasks t
           SET claimed_by = ${sid}, claimed_at = now(),
               -- Primera vez que alguien la coge: separa «costó mucho» de «esperó mucho» (T-414).
               first_claimed_at = COALESCE(t.first_claimed_at, now()),
               -- Quién la tiene por última vez (T-430): claimed_by se pone a NULL al soltar,
               -- pausar o segar, así que sin esto no hay a quién preguntar cuando una sesión
               -- muere de golpe y deja trabajo sin pushear en su worktree.
               last_claimed_by = ${sid},
               lease_until = now() + (${LEASE_MIN} || ' minutes')::interval,
               status = CASE WHEN t.status = 'open' THEN 'in_progress' ELSE t.status END,
               force_claim_reason = CASE WHEN ${force} THEN ${forceMotivo || null} ELSE t.force_claim_reason END,
               force_claimed_at   = CASE WHEN ${force} THEN now() ELSE t.force_claimed_at END
         WHERE t.id = (
           SELECT id FROM public.backlog_tasks
            WHERE id = ${id}
              AND status IN ('open','in_progress','blocked')
              AND (claimed_by IS NULL OR claimed_by = ${sid} OR lease_until < now())
              -- reloj: una aplazada no se entrega (salvo --force)
              AND (${force} OR snooze_until IS NULL OR snooze_until <= now())
              -- deploy: si espera a que su commit esté vivo, tampoco (salvo --force)
              AND (${force} OR wake_on_deploy_sha IS NULL)
              -- revisión humana: entregada y sin mirar, tampoco (T-539, salvo --force).
              -- Va en el MISMO UPDATE atómico que las otras, no solo en el mensaje de error: la
              -- simulación destapó que con la comprobación únicamente en claimGate la tarea se
              -- entregaba igual, y el gate solo servía para explicar un fallo que no ocurría.
              -- (sin comillas invertidas aquí dentro: esto es una plantilla de JS y las cierra)
              AND (${force} OR review_requested_at IS NULL)
              -- dependencia: bloqueada por otra tarea NUESTRA aún viva (salvo --force)
              AND (${force} OR NOT EXISTS (
                    SELECT 1 FROM public.backlog_tasks d
                     WHERE d.id = ANY(COALESCE(backlog_tasks.blocked_by, '{}'))
                       AND d.status IN ('open','in_progress','blocked')))
            FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING id, title, priority, blocked_by, snooze_until, snooze_reason, snooze_count, due_at, due_reason`;
      if (!row) {
        const [cur] = await s`
          SELECT id, title, status, claimed_by, lease_until, snooze_until, snooze_reason, blocked_by,
                 wake_on_deploy_sha, wake_on_deploy_surface,
                 review_requested_at, review_note, review_requested_by
            FROM public.backlog_tasks WHERE id = ${id}`;
        if (!cur) { console.error(`❌ ${id} no existe (¿has corrido 'sync'?)`); process.exit(1); }
        const abiertas = await s`SELECT id FROM public.backlog_tasks WHERE status IN ('open','in_progress','blocked')`;
        const gate = claimGate(cur, sid, new Date(), new Set(abiertas.map((r) => r.id)));
        console.error(`❌ ${id} — ${gate.reason || 'no se puede coger ahora'}`);
        if (gate.code === 'awaiting_deploy') {
          console.error(`   🚀 la despertará el propio deploy al terminar (o: node scripts/backlog.cjs deployed <sha>).`);
        }
        if (gate.code === 'snoozed') {
          console.error(`   🕒 despierta sola el ${cuando(cur.snooze_until)}; hasta entonces no hay nada que hacer en ella.`);
        }
        if (gate.forzable) {
          console.error(`   Si aun así vas a trabajarla (p.ej. adelantar preparación):`);
          console.error(`      node scripts/backlog.cjs claim ${id} --force --motivo "…"`);
        }
        process.exit(1);
      }
      console.log(`✅ CLAIM ${row.id} — ${row.title}`);
      if (force) console.log(`   ⚠️ COGIDA A LA FUERZA (queda registrado): ${forceMotivo}`);
      if ((row.blocked_by || []).length) console.log(`   ⚠️ declarada bloqueada por: ${row.blocked_by.join(', ')}`);
      if (isChronicSnooze(row)) console.log(`   🔁 aplazada ${row.snooze_count} veces ya — si no toca, quizá no es una tarea programada sino una decisión pendiente.`);
      // Lo que se dejó a medias la última vez que se pausó: sin esto, retomar es empezar de cero.
      const [notas] = await s`SELECT progress_note, resume_check FROM public.backlog_tasks WHERE id = ${row.id}`;
      if (notas && (notas.progress_note || notas.resume_check)) {
        console.log('   ── se retoma donde se dejó ──');
        if (notas.progress_note) console.log(`   ✔ hecho:  ${notas.progress_note}`);
        if (notas.resume_check) console.log(`   ▶ falta:  ${notas.resume_check}`);
      }
      // El PLAZO se canta al cogerla, no en la ficha: enterarte de que vence hoy después de
      // leer treinta líneas es enterarte tarde.
      if (row.due_at) {
        const p = clasificarPlazo(row.due_at, new Date());
        const cuanto = p.banda === 'vencida' ? `VENCIÓ hace ${-p.dias} día(s)` : p.banda === 'hoy' ? 'VENCE HOY' : `vence en ${p.dias} día(s)`;
        console.log(`   ${p.icono} FECHA LÍMITE: ${cuando(row.due_at)} — ${cuanto}`);
        console.log(`      ${row.due_reason}`);
      }
      console.log(`   lease ${LEASE_MIN} min · renueva con: node scripts/backlog.cjs heartbeat`);
      // Reclamar = LEER: escupimos la ficha entera del markdown. Así no existe "abrir la
      // tarea" separado de "reclamarla" → se elimina la ventana de olvido (el pre-push
      // bloquea de todos modos, pero esto lo hace innecesario en el flujo normal).
      const ficha = fichaBody(row.id);
      if (ficha) console.log(`\n${'─'.repeat(60)}\n${ficha}\n${'─'.repeat(60)}`);
      await avisarSolape(s, row.id, ficha);
      await sugerirRelacionadas(s, row.id, ficha);
      await ofrecerTrabajoDeLaSesionAnterior(s, dueñoAnterior);
      recordarComoSeTrabaja(row.title);
    }

    else if (cmd === 'heartbeat') {
      needSid();
      const rows = await s`
        UPDATE public.backlog_tasks
           SET lease_until = now() + (${LEASE_MIN} || ' minutes')::interval
         WHERE claimed_by = ${sid} AND status IN ('open','in_progress','blocked')
        RETURNING id`;
      console.log(rows.length ? `✅ lease renovado (${LEASE_MIN} min): ${rows.map((r) => r.id).join(', ')}`
                              : 'No tienes tareas cogidas.');
      // El OTRO momento en que la regla es aplicable AHORA (T-495): renovar el lease significa que
      // llevas rato con la misma tarea, o sea que el recordatorio del `claim` ya está sepultado.
      // El umbral lo decide el núcleo puro; aquí solo se le pasa cuánto llevas.
      if (rows.length) {
        const [t] = await s`
          SELECT EXTRACT(EPOCH FROM (now() - claimed_at)) / 60 AS minutos
            FROM public.backlog_tasks WHERE claimed_by = ${sid} AND claimed_at IS NOT NULL
           ORDER BY claimed_at LIMIT 1`;
        const rec = RECORDATORIO.recordatorioPorTiempo(Number(t?.minutos || 0));
        if (rec) { console.log(''); for (const l of rec.lineas) console.log(l); }
      }
    }

    else if (cmd === 'mine') {
      needSid();
      const rows = await s`
        SELECT id, title, status, lease_until FROM public.backlog_tasks
         WHERE claimed_by = ${sid} ORDER BY id`;
      if (!rows.length) console.log('No tienes tareas cogidas.');
      for (const r of rows) console.log(`  ${r.id} | ${r.status} | lease: ${left(r.lease_until)} | ${r.title}`);
    }

    else if (cmd === 'done') {
      needSid();
      const id = process.argv[3];
      const outcome = arg('--outcome');
      if (!id || !outcome) { console.error('Uso: backlog.cjs done <T-xxx> --outcome "qué pasó de verdad"'); process.exit(2); }
      // PUERTA, no aviso (30/07). Cerrar con un outcome que confiesa trabajo pendiente saca la
      // tarea del backlog Y deja el trabajo sin hacer — y encima con apariencia de terminada.
      // Programar el regreso no puede depender de que alguien se acuerde: si el texto dice que
      // falta algo, aquí se para y se manda a `pause`, que sí agenda la vuelta.
      const pend = detectarTrabajoPendiente(outcome);
      if (pend.pendiente && !process.argv.includes('--igualmente')) {
        // Decir QUÉ frase lo disparó (T-499): sin eso, la reacción natural es probar outcomes
        // hasta que uno pase — y al cerrar [T-497] eso acabó guardando el outcome literal «test».
        console.error(`❌ NO cerrada: el outcome ${pend.motivo}${pend.fragmento ? ` («${pend.fragmento}»)` : ''}, así que la tarea NO está terminada.`);
        console.error('   Si queda trabajo, prográmale la vuelta en vez de cerrarla en falso:');
        console.error(`     node scripts/backlog.cjs pause ${id} --tras-deploy --superficie frontend|backend|both \\`);
        console.error('       --hecho "…lo que ya está…" --falta "…lo que queda…"');
        console.error(`     node scripts/backlog.cjs pause ${id} --hasta "2026-08-11 07:00" --hecho "…" --falta "…"`);
        console.error('   Si de verdad está terminada y el texto engaña:  --igualmente');
        process.exit(2);
      }

      // SEGUNDA PUERTA (T-392 F1): la de arriba mira EL TEXTO —caza al que confiesa—; esta mira
      // LOS HECHOS, que no se pueden maquillar. Si los commits que DECLARAN esta tarea tocan una
      // superficie servida y el `sha` vivo todavía no los incluye, la tarea no está terminada
      // diga lo que diga el outcome. Es lo que faltó el 31/07 con T-363, que decide cuándo se le
      // cobra a alguien y se cerró con el código en `main`, sin desplegar y sin verificar.
      //
      // Fail-open y silencioso ante cualquier problema: un fallo de red no puede impedir cerrar.
      if (!process.argv.includes('--igualmente')) {
        try {
          const { analizar } = require(path.join(REPO, 'scripts', 'backlog', 'verificacion.cjs'));
          const v = await analizar(id);
          if (v.exige) {
            const sup = v.superficies.length === 2 ? 'both' : v.superficies[0];
            console.error(`❌ NO cerrada: ${v.motivo}.`);
            console.error('   Su código todavía NO está vivo, así que no se puede haber verificado:');
            for (const f of v.servidos.slice(0, 5)) console.error(`     [${f.superficie}] ${f.fichero}`);
            if (v.servidos.length > 5) console.error(`     …y ${v.servidos.length - 5} más`);
            console.error('   Prográmale la vuelta — el propio deploy la despierta:');
            console.error(`     node scripts/backlog.cjs pause ${id} --tras-deploy --superficie ${sup} \\`);
            console.error('       --hecho "…lo que ya está…" --falta "…qué mirar cuando esté vivo…"');
            console.error('   Si de verdad ya lo verificaste (o el análisis se equivoca):  --igualmente');
            friccion('guard_bloqueo', 'done-verificacion', id);
            process.exit(2);
          }
        } catch { /* fail-open: el gate no puede tumbar un cierre por un fallo suyo */ }
      } else {
        friccion('guard_escape', 'done-verificacion', id);
      }
      const [row] = await s`
        UPDATE public.backlog_tasks
           SET status = 'done', outcome = ${outcome}, closed_at = now(),
               -- Acumular lo trabajado ANTES de soltar el claim (T-414): hasta hoy esto ponía
               -- claimed_at a NULL y con ello se BORRABA el único dato que permite contrastar
               -- una estimación de esfuerzo. Medido antes del cambio: 0 tareas con duración
               -- medible en todo el backlog.
               worked_seconds = COALESCE(worked_seconds, 0)
                              + GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (now() - claimed_at))::int, 0)),
               claimed_by = NULL, claimed_at = NULL, lease_until = NULL
         WHERE id = ${id} AND (claimed_by = ${sid} OR claimed_by IS NULL)
        RETURNING id, title, effort, worked_seconds, resume_check`;
      if (!row) { console.error(`❌ no pude cerrar ${id} (¿la tiene otra sesión?)`); process.exit(1); }
      console.log(`✅ ${row.id} cerrada.`);
      // Si venía de una pausa, se cierra algo que estaba pendiente de COMPROBAR: recordar qué
      // significa la palabra, porque `done` se lee como «funciona» y solo garantiza «lo hice».
      if (row.resume_check) console.log('   (venía de «implementada y sin comprobar»: el outcome debería decir QUÉ verificaste)');
      // Contrastar lo DECLARADO con lo que costó. Es la razón de ser del campo de esfuerzo: sin
      // este momento, la estimación no se puede desmentir nunca y acaba siendo decorativa.
      if (row.worked_seconds > 0) {
        const c = ESF.contrastar({ effort: row.effort, workedSeconds: row.worked_seconds });
        const dur = ESF.formatearDuracion(row.worked_seconds);
        if (c.veredicto === 'sin_datos') {
          console.log(`   ⏱ ${dur} trabajados${row.effort ? '' : ' (sin esfuerzo declarado: se pierde el contraste)'}`);
        } else if (c.veredicto === 'acertada') {
          console.log(`   ⏱ ${dur} — declaraste «${row.effort}»: ajustado.`);
        } else if (c.veredicto === 'pasada') {
          console.log(`   ⏱ ${dur} — declaraste «${row.effort}» (techo ${c.techo} h): se PASÓ. Vale para calibrar.`);
        } else {
          console.log(`   ⏱ ${dur} — declaraste «${row.effort}» y salió MÁS CORTA de lo previsto.`);
        }
      }
      console.log(`   ⚠️ AHORA mueve su entrada a "## Hechas" en docs/roadmap/tareas-pendientes.md`);
      console.log(`      (el guardarraíl de CI falla si sigue en "Abiertas")`);
      // Cerrar es el momento en que el contexto está más cargado y a punto de tirarse (T-498).
      await sugerirSiguiente(s, id, sid);
    }

    else if (cmd === 'reopen') {
      // REABRIR una tarea cerrada. El hueco lo destapó el propio sistema, dos veces el mismo día
      // (30/07): por la mañana hubo que reabrir 3 fichas cerradas EN FALSO y no había comando —se
      // hizo a mano—; por la tarde, T-270 se cerró y **el guardarraíl `cpuBoundRoutes` lo cazó**
      // (su lista de excepciones exige ficha ABIERTA, y cerrarla dejaba la excepción huérfana).
      //
      // Sin este comando, deshacer un cierre equivocado exige tocar la BD por fuera de la
      // herramienta que la gobierna, y mientras tanto la tarea **desaparece de `list`**: que es
      // exactamente enterrar el trabajo, el riesgo que Manuel señaló esa misma mañana.
      //
      // Pide motivo a propósito: reabrir es rehacer una decisión y debe quedar por qué.
      needSid();
      const id = process.argv[3];
      const motivo = arg('--motivo');
      if (!id || !motivo) {
        console.error('Uso: backlog.cjs reopen <id> --motivo "por qué se reabre"');
        process.exit(2);
      }
      const [prev] = await s`SELECT id, status, outcome FROM public.backlog_tasks WHERE id = ${id}`;
      if (!prev) { console.error(`❌ ${id} no existe.`); process.exit(1); }
      if (prev.status !== 'done') {
        console.error(`❌ ${id} no está cerrada (status: ${prev.status}) — no hay nada que reabrir.`);
        process.exit(1);
      }
      // El outcome anterior NO se borra: se conserva en `progress_note` para que la próxima sesión
      // vea qué se creyó terminado y por qué no lo estaba. Un reopen que borra la historia obliga
      // a repetir la investigación que llevó a reabrir.
      const [row] = await s`
        UPDATE public.backlog_tasks
           SET status = 'open', outcome = NULL, closed_at = NULL,
               -- Acumular lo trabajado ANTES de soltar el claim (T-414): hasta hoy esto ponía
               -- claimed_at a NULL y con ello se BORRABA el único dato que permite contrastar
               -- una estimación de esfuerzo. Medido antes del cambio: 0 tareas con duración
               -- medible en todo el backlog.
               worked_seconds = COALESCE(worked_seconds, 0)
                              + GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (now() - claimed_at))::int, 0)),
               claimed_by = NULL, claimed_at = NULL, lease_until = NULL,
               progress_note = concat_ws(E'\n',
                 ${'REABIERTA: ' + motivo}::text,
                 ${'(cierre anterior decía: ' + String(prev.outcome || '—').slice(0, 400) + ')'}::text,
                 progress_note)
         WHERE id = ${id} RETURNING id, title`;
      console.log(`♻️  ${row.id} REABIERTA — ${row.title}`);
      console.log(`   motivo: ${motivo}`);
      console.log(`   ⚠️ AHORA devuelve su entrada a "## Abiertas" en docs/roadmap/tareas-pendientes.md`);
      console.log(`      (el guardarraíl de CI falla si se queda en "Hechas")`);
    }

    else if (cmd === 'release') {
      needSid();
      const id = process.argv[3];
      const [row] = await s`
        UPDATE public.backlog_tasks
           SET -- Acumular lo trabajado ANTES de soltar el claim (T-414): hasta hoy esto ponía
               -- claimed_at a NULL y con ello se BORRABA el único dato que permite contrastar
               -- una estimación de esfuerzo. Medido antes del cambio: 0 tareas con duración
               -- medible en todo el backlog.
               worked_seconds = COALESCE(worked_seconds, 0)
                              + GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (now() - claimed_at))::int, 0)),
               claimed_by = NULL, claimed_at = NULL, lease_until = NULL,
               status = CASE WHEN status = 'in_progress' THEN 'open' ELSE status END
         WHERE id = ${id} AND claimed_by = ${sid} RETURNING id`;
      console.log(row ? `✅ ${row.id} liberada.` : '❌ no era tuya (o no existe).');
    }

    // ── reap: devolver al pool los claims de sesiones MUERTAS ───────────────────────────────
    //
    // «Lease, no lock» está a medias: `claim` sí entrega una fila con el lease vencido, pero
    // NADIE limpia la fila. Se queda `in_progress` con el `claimed_by` de una sesión que no
    // existe, para siempre. Medido el 31/07: T-214, T-221 y T-238 llevaban 72-79 h así, y sus
    // sesiones (`cordoba-plazas`, `clonado-provenance`, `sesion-28jul-d`) ya no tenían ni
    // worktree ni latido. `list` las pintaba «🟡 lease caducado (libre)» —cosmético— mientras
    // el registro seguía diciendo que alguien las estaba haciendo.
    //
    // No es solo higiene: cualquiera que MENCIONARA una de esas tres en un commit se comía un
    // «la tiene la sesión X — coordina o espera a que libere» de un muerto (arreglado también
    // en lib/backlog/pushGuard.cjs, pero la fila hay que limpiarla igual).
    //
    // DRY-RUN por defecto: soltar el trabajo de otra sesión es justo lo que este subsistema
    // existe para no hacer por accidente. `--horas` (24 por defecto) es el margen sobre el
    // vencimiento — el lease son 90 min, así que 24 h ya es una sesión inequívocamente muerta.
    else if (cmd === 'reap') {
      const horas = Number(arg('--horas') || 24);
      const aplicar = process.argv.includes('--apply');
      const muertas = await s`
        SELECT id, title, claimed_by, lease_until, status
          FROM public.backlog_tasks
         WHERE status = 'in_progress'
           AND claimed_by IS NOT NULL
           AND lease_until IS NOT NULL
           AND lease_until < now() - (${horas} || ' hours')::interval
         ORDER BY lease_until`;
      if (!muertas.length) {
        console.log(`✅ ningún claim muerto (lease vencido hace más de ${horas} h).`);
      } else {
        console.log(`${aplicar ? '🧹 SEGANDO' : '👁  SIMULACIÓN'} — ${muertas.length} claim(s) de sesión muerta:`);
        for (const m of muertas) {
          const h = Math.round((Date.now() - new Date(m.lease_until).getTime()) / 3600_000);
          console.log(`   ${m.id}  ${String(m.claimed_by).slice(0, 24).padEnd(26)} lease vencido hace ${h} h`);
          console.log(`      ${String(m.title).slice(0, 88)}`);
        }
        if (!aplicar) {
          console.log('\n   Nada escrito. Para devolverlas al pool:  node scripts/backlog.cjs reap --apply');
        } else {
          const ids = muertas.map((m) => m.id);
          const upd = await s`
            UPDATE public.backlog_tasks
               -- Aquí NO se acumula tiempo trabajado, a propósito (T-414). Estas son sesiones
               -- MUERTAS: su claimed_at puede tener tres días y nadie estuvo trabajando tres
               -- días. Sumarlo envenenaría la única medida que sirve para contrastar las
               -- estimaciones — y una medida envenenada es peor que no tenerla.
               SET status = 'open',
               claimed_by = NULL, claimed_at = NULL, lease_until = NULL
             WHERE id IN ${s(ids)} AND status = 'in_progress' AND lease_until < now()
            RETURNING id`;
          console.log(`\n✅ ${upd.length} devuelta(s) al pool (open, sin dueño). El contexto de la ficha no se toca.`);
        }
      }
    }

    // ── esfuerzo: declarar cuánto se cree que cuesta, en cajones (T-414) ──────────────────
    // No en horas: una estimación en horas se vuelve ficción («2h» para todo) y envejece sola,
    // igual que las fechas que se escribían en los títulos. El corte que cambia una decisión es
    // el último: si necesita sesión propia, no la encajas al final de la que tienes.
    else if (cmd === 'esfuerzo') {
      const id = process.argv[3];
      const cajon = process.argv[4];
      if (!id || !ESF.esValido(cajon)) {
        console.error('Uso: backlog.cjs esfuerzo <T-xxx> <' + ESF.CAJONES.join('|') + '>');
        for (const c of ESF.CAJONES) console.error(`   ${c.padEnd(14)} ${ESF.DESCRIPCION[c]}`);
        process.exit(2);
      }
      const [row] = await s`
        UPDATE public.backlog_tasks SET effort = ${cajon}
         WHERE id = ${id} RETURNING id, title, effort, worked_seconds`;
      if (!row) { console.error(`❌ ${id} no existe`); process.exit(1); }
      console.log(`✅ ${row.id} → esfuerzo «${row.effort}»: ${ESF.DESCRIPCION[row.effort]}`);
      const c = ESF.contrastar({ effort: row.effort, workedSeconds: row.worked_seconds });
      if (c.veredicto !== 'sin_datos') {
        console.log(`   (ya lleva ${ESF.formatearDuracion(row.worked_seconds)} trabajados → estimación ${c.veredicto})`);
      }
    }

    else if (cmd === 'sync') {
      // Importa del markdown los ids que aún no están en la tabla, y RECONCILIA el
      // título y la prioridad de las que ya están.
      //
      // El reparto sigue siendo el de siempre: el ESTADO (quién la tiene, en qué
      // acabó) vive en BD y el markdown no lo toca; el CONTENIDO (título, prioridad)
      // vive en el markdown y la BD lo copia. Antes esto era `DO NOTHING` y la
      // segunda mitad no ocurría nunca, con dos consecuencias reales (27/07, T-178):
      //
      //   · `reserve` promete en su propia salida que «luego sync actualizará el
      //     título real», y no lo hacía: T-148, T-153 y T-154 llevaban días vivas
      //     con el título provisional RESERVADA aunque su ficha estuviera escrita.
      //     `list` y `next` las mostraban así, es decir, ilegibles para elegir.
      //   · Una prioridad corregida en el markdown no llegaba a la tabla: T-089 se
      //     bajó de 🔴 a 🟡 el 25/07 al superar el gate de pico y `next` seguía
      //     ofreciéndola como crítica a TODAS las sesiones.
      //
      // Solo se reconcilian las VIVAS: en una cerrada, el título con el que se
      // trabajó es historia y reescribirlo falsearía el registro.
      const md = parseMd();

      // FICHAS HUÉRFANAS, ANTES QUE NADA. Es una comprobación de SOLO LECTURA y no depende de
      // que el resto del sync vaya bien, así que no puede vivir al final: los dos abortos de
      // abajo hacen `process.exit(2)` y se la llevan por delante.
      //
      // Pasó el 29/07 y costó las fichas de T-251 y T-254: un commit de tests (`4127f3e17`) subió
      // una copia RANCIA del markdown y borró las dos fichas de `main`. La tarea seguía viva en la
      // tabla, así que `list` la ofrecía por su título… sin ficha detrás que leer. El aviso que lo
      // habría cazado existía —«VIVA en BD pero SIN ficha»— pero el sync abortaba antes por una
      // colisión de id AJENA (T-219) y nunca llegaba a imprimirlo. Un hallazgo que solo se publica
      // cuando todo lo demás está bien es un hallazgo que falta justo el día que hace falta.
      // Y se SEPARA la regresión del trabajo en vuelo: con 2-10 sesiones a la vez, que otra tenga
      // el id reservado y la ficha sin pushear es lo normal, no un fallo. Avisar de las dos cosas
      // igual gasta el aviso — el mismo final que tuvo cuando incluía a las CERRADAS
      // (T-033/T-039/T-046). La prueba de que la ficha EXISTIÓ es el historial del fichero.
      const vivas = await s`SELECT id, claimed_by FROM public.backlog_tasks WHERE status IN ('open','in_progress','blocked')`;
      const idsEnMd = new Set(md.map((t) => t.id));
      const sinFicha = vivas.filter((r) => !idsEnMd.has(r.id));
      if (sinFicha.length) {
        // La prueba de que una ficha existió está en `origin/main`, NO en mi rama (T-427). Se
        // refresca la ref antes de opinar: sin fetch, una ficha borrada hace diez minutos se ve
        // «todavía presente» y el aviso llega tarde. Best-effort y con techo de tiempo.
        refrescarOrigin({ cwd: REPO });
        const { clasificarHuerfanas } = require(path.join(REPO, 'lib', 'backlog', 'fichaHuerfana.cjs'));
        // Los hechos de git viven en SU módulo. El CLI tenía su propio pickaxe y por eso el
        // detector miraba MI rama: una ficha ajena borrada de `main` que nunca pasó por aquí no
        // dejaba rastro local y salía «sin pushear», que es el aviso benigno. Dos lectores de git
        // con criterios distintos es exactamente cómo nació el punto ciego.
        // Sin refrescar, `origin/main` es la foto de la última vez que alguien hizo fetch: se
        // opinaría sobre un pasado y las fichas recién pusheadas saldrían como borradas.
        const { borradas, noVerificables, miasSinEscribir, desactualizadas, enOtraRama, sinPushear } =
          clasificarHuerfanas(sinFicha.map((r) => ({
            id: r.id,
            estuvoEnElMarkdown: estuvoEnElHistorialLocal(r.id, GIT_FICHAS),
            // Si el claim es MÍO, «otra sesión no la ha pusheado» es imposible: la sesión soy yo.
            esMia: r.claimed_by === sid,
            origen: hechosDeOrigin(r.id, GIT_FICHAS),
            // Y si está commiteada en CUALQUIER rama, existe: es trabajo en vuelo, no perdido.
            ramas: enAlgunaRama(r.id, GIT_FICHAS),
          })));
        if (borradas.length) {
          console.error(`🔴 FICHA BORRADA del markdown y la tarea sigue VIVA: ${borradas.join(', ')}`);
          console.error('   Alguien commiteó el fichero rancio y se llevó la ficha por delante.');
          for (const id of borradas) {
            // El aviso no puede morir en la consola de quien corrió el sync: quien perdió la ficha
            // es OTRA sesión, que no lo ve. Va al bus que ya usa todo el proyecto, con su regla de
            // alerta (`RULE_BACKLOG_FICHA_BORRADA`) para que no sea un evento ciego.
            const culpable = commitQueLaQuito(id, GIT_FICHAS);
            if (culpable) console.error(`   ${id} ← la quitó:  ${culpable}`);
            console.error(`   recupérala:  git log -S'### [${id}]' -- ${MD_REL}`);
            // OBSERVABILIDAD — que no dependa de que alguien esté mirando esta terminal: quien
            // BORRA la ficha no es quien corre el `sync` después, y la sesión víctima puede estar
            // muerta ya. Best-effort: la telemetría no puede tumbar un `sync`.
            try {
              await s`INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
                VALUES (gen_random_uuid(), now(), 'cli', 'warn', 'backlog_ficha_borrada',
                        ${s.json({ tarea: id, commit: culpable || null, detectada_por: sid })}, now())`;
            } catch { /* observabilidad fail-open, nunca bloquea el sync */ }
          }
        }
        if (noVerificables.length) {
          console.error(`⚠️  no puedo comprobar si estas fichas existieron (sin ver origin/main): ${noVerificables.join(', ')}`);
          console.error('   No es «están bien»: es que no lo sé. Comprueba el remoto y vuelve a correr el sync.');
        }
        if (desactualizadas.length) {
          console.log(`↻ están en origin/main y tu rama va por detrás: ${desactualizadas.join(', ')}`);
          console.log('   No falta nada: actualiza la rama (git pull --rebase origin main).');
        }
        if (miasSinEscribir.length) {
          console.error(`🟠 RECLAMADA POR TI y SIN FICHA en ninguna parte: ${miasSinEscribir.join(', ')}`);
          console.error('   No es trabajo de otra sesión: la tienes tú. Escribe la ficha o suéltala');
          console.error('   (`release`). Sin ficha, quien la coja después empieza sin contexto.');
        }
        if (enOtraRama.length) {
          console.log(`ℹ️ commiteada(s) en la rama de otra sesión, pendiente(s) de fusionar: ${
            enOtraRama.map((h) => h.donde ? `${h.id} (${h.donde})` : h.id).join(', ')}`);
        }
        if (sinPushear.length) {
          // Se dice «en NINGUNA rama» a propósito: es la misma pinta que tiene el trabajo PERDIDO
          // (T-407 se escribió, se cerró en la BD y nunca llegó a un commit), y quien lo lea tiene
          // que poder distinguirlo de una ficha que otra sesión aún está escribiendo.
          console.log(`ℹ️ sin ficha en NINGUNA rama todavía (se está escribiendo… o se perdió): ${sinPushear.join(', ')}`);
        }
      }

      // COLISIÓN DE ID antes de escribir nada. Si el markdown trae el mismo id dos veces es que
      // alguien eligió un número "libre" mirando el fichero, sin ver que otra sesión ya lo había
      // ocupado en la BD (que es la fuente de verdad del claim). Seguir adelante sería peor que
      // parar: el UPDATE de reconciliación de abajo le PISA EL TÍTULO a la tarea ajena y lo reporta
      // como un "↻" de aspecto inofensivo. Pasó 4 veces el 28/07 (T-188, T-196, T-201, T-204) —
      // siempre con `reserve` disponible y sin que nadie supiera que existía.
      const vistos = new Map();
      const colisiones = [];
      for (const t of md) {
        if (vistos.has(t.id)) colisiones.push({ id: t.id, a: vistos.get(t.id), b: t.title });
        else vistos.set(t.id, t.title);
      }
      if (colisiones.length) {
        console.error(`❌ sync ABORTADO: ${colisiones.length} id(s) duplicado(s) en el markdown.`);
        for (const c of colisiones) {
          console.error(`   ${c.id}`);
          console.error(`      · ${String(c.a).slice(0, 70)}`);
          console.error(`      · ${String(c.b).slice(0, 70)}`);
        }
        console.error('   Renumera la ficha NUEVA y reserva su id de forma atómica:');
        console.error('      node scripts/backlog.cjs reserve "<título>"');
        console.error('   (`reserve` mira la BD, no el markdown: es la única forma de no chocar con otra sesión.)');
        process.exit(2);
      }

      // COLISIÓN CON LA BD — la otra mitad del mismo fallo. El bloque de arriba solo ve ids
      // repetidos DENTRO del markdown, y el choque entre sesiones no se ve ahí: la otra sesión
      // reserva el id en la tabla y su ficha tarda en llegar a tu copia del fichero, así que en tu
      // markdown el id aparece UNA vez —la tuya— y no hay nada que comparar. Pasó el 28/07 con
      // T-225: el `sync` reconcilió tan tranquilo y le pisó el título a la tarea ajena. La única
      // fuente de verdad de los ids es la tabla, así que se pregunta a la tabla.
      const idsMd = md.filter((t) => t.declaredOpen).map((t) => t.id);
      if (idsMd.length) {
        const { esColisionReal } = require(path.join(REPO, 'lib', 'backlog', 'syncGuard.cjs'));
        const enBd = await s`
          SELECT id, title FROM public.backlog_tasks
           WHERE id IN ${s(idsMd)} AND status IN ('open','in_progress','blocked')`;
        const porId = new Map(enBd.map((r) => [r.id, r.title]));
        // Solo es colisión si además la ficha NO estaba ya en el historial de ESTE fichero: si
        // estaba, es nuestra y lo que ha cambiado es el título (retitular al aprender algo es
        // normal). Sin esta segunda condición, cada retitulado a fondo abortaba el sync de TODAS
        // las sesiones — pasó dos veces el 29/07 en diez minutos (T-219 y T-089).
        const ajenas = md
          .filter((t) => porId.has(t.id) && esColisionReal({
            tituloBd: porId.get(t.id), tituloMd: t.title,
            // Perezoso: `git log -S` sobre este markdown cuesta ~1 s y solo hace falta cuando
            // los títulos ya difieren. Ver el comentario en esColisionReal.
            estuvoEnElHistorial: () => estuvoEnElHistorial(t.id),
          }))
          .map((t) => ({ id: t.id, bd: porId.get(t.id), md: t.title }));
        if (ajenas.length) {
          console.error(`❌ sync ABORTADO: ${ajenas.length} id(s) ya ocupado(s) en la BD por OTRA tarea.`);
          for (const c of ajenas) {
            console.error(`   ${c.id}`);
            console.error(`      · en BD:       ${String(c.bd).slice(0, 70)}`);
            console.error(`      · tu markdown: ${String(c.md).slice(0, 70)}`);
          }
          console.error('   Otra sesión reservó ese id y su ficha aún no ha llegado a tu copia.');
          console.error('   Renumera TU ficha con un id reservado de forma atómica:');
          console.error('      node scripts/backlog.cjs reserve "<título>"');
          console.error('   (Si de verdad estás RETITULANDO tu propia ficha, cambia el título en la BD a mano.)');
          process.exit(2);
        }
      }

      let nuevos = 0;
      let reconciliadas = 0;
      const cambios = [];
      for (const t of md) {
        // Una tarea ya cerrada (fuera de "Abiertas" o marcada ✅) entra directamente como
        // done. El constraint backlog_cierre_coherente exige closed_at → se pone aquí.
        const cerrada = !t.declaredOpen;
        const [r] = await s`
          INSERT INTO public.backlog_tasks (id, title, priority, status, closed_at, outcome)
          VALUES (${t.id}, ${t.title}, ${t.priority},
                  ${cerrada ? 'done' : 'open'},
                  ${cerrada ? s`now()` : null},
                  ${cerrada ? 'Importada ya cerrada en el sync inicial (ver su ficha en el markdown).' : null})
          ON CONFLICT (id) DO NOTHING RETURNING id`;
        if (r) { nuevos++; continue; }
        // Ya existía. NO se reconcilia lo que el markdown da por cerrado aunque la
        // fila siga viva: eso es DERIVA (T-072 el 27/07 — ✅ en el markdown, `open`
        // en BD) y le toca delatarla a `findBacklogDrift()`. Copiarle el título
        // "CERRADA …" a una fila abierta la disfrazaría de normal.
        if (cerrada) continue;
        // Reconciliar contenido si difiere y la tarea sigue viva.
        const [u] = await s`
          UPDATE public.backlog_tasks
             SET title = ${t.title}, priority = ${t.priority}
           WHERE id = ${t.id}
             AND status IN ('open','in_progress','blocked')
             AND (title IS DISTINCT FROM ${t.title} OR priority IS DISTINCT FROM ${t.priority})
          RETURNING id, title, priority`;
        if (u) { reconciliadas++; cambios.push(`${u.id} [${u.priority}] ${String(u.title).slice(0, 46)}`); }
      }
      console.log(`sync: ${md.length} en markdown · ${nuevos} nueva(s) insertada(s) · ${reconciliadas} reconciliada(s).`);
      for (const c of cambios) console.log(`   ↻ ${c}`);
      // El aviso de fichas huérfanas se da ARRIBA, antes de los abortos (ver el comentario allí).
      // Solo se miran las VIVAS: una tarea viva sin ficha no se puede trabajar (nadie sabe qué es),
      // mientras que borrar la ficha de una CERRADA es limpieza legítima y documentada — incluirlas
      // producía un aviso permanentemente falso (T-033/T-039/T-046) que enseñaba a ignorar el sync.
    }

    // ── reserve ────────────────────────────────────────────────────────────────
    // Reserva ATÓMICAMENTE el siguiente id libre y lo imprime, para escribir la
    // ficha en el markdown con un id que ya nadie más puede tomar.
    //
    // POR QUÉ EXISTE (26/07/2026): los ids se acuñaban mirando el markdown —que es
    // per-worktree— y la reserva atómica solo llegaba con `sync`, DESPUÉS de haber
    // escrito la ficha. Con sesiones en paralelo eso es una carrera: dos sesiones
    // leen "el siguiente libre es T-123", ambas escriben su ficha con ese id y al
    // fusionar hay dos tareas distintas con el mismo número. Pasó DOS VECES el
    // mismo día (T-123 y T-126, esta última cerrada por la otra sesión con un
    // `outcome` que no correspondía a la ficha escrita aquí). El guardarraíl de
    // ids únicos lo caza en CI, pero tarde: cuando ya hay que renumerar a mano.
    //
    // El INSERT con el título provisional es lo que hace la reserva real: a partir
    // de ahí `ON CONFLICT DO NOTHING` del sync respeta la fila y el id es tuyo.
    // APLAZAR (snooze): la tarea espera a un RELOJ, no a una persona ni a otra tarea.
    // Es lo tercero que faltaba junto al claim (`lease_until`) y la dependencia (`blocked_by`).
    // Ver el porqué en supabase/migrations/20260728_backlog_snooze.sql: T-221 llegó a llevar
    // "⛔ NO COGER HASTA EL 29/07 07:00 UTC" en el TÍTULO, y `next` la ofrecía igual.
    // FECHA LÍMITE: lo contrario de `snooze`. Aquella dice cuándo EMPEZAR; esta, cuándo deja de
    // servir. Nació el 31/07/2026 con T-330 (una newsletter cuyo valor moría esa noche, y lo
    // único que lo decía era la palabra «hoy» en un título escrito el día anterior).
    else if (cmd === 'due') {
      const id = process.argv[3];
      if (!id) { console.error('Uso: backlog.cjs due <T-xxx> --fecha "<ISO|YYYY-MM-DD HH:MM>" --motivo "quién lo espera o qué fecha externa lo fija"  |  --quitar'); process.exit(2); }
      if (process.argv.includes('--quitar')) {
        const [row] = await s`UPDATE public.backlog_tasks SET due_at = NULL, due_reason = NULL WHERE id = ${id} RETURNING id, title`;
        if (!row) { console.error(`❌ ${id} no existe`); process.exit(1); }
        console.log(`✅ ${row.id} se queda SIN fecha límite — ${row.title}`);
        return;
      }
      const fecha = arg('--fecha') || arg('--hasta');
      const motivo = arg('--motivo') || arg('--reason');
      // La guarda vive en el núcleo puro (con tests): un plazo sin motivo externo es una
      // preferencia disfrazada, y si se permiten en un mes todo es urgente y nada lo es.
      const v = validarPlazo(fecha, motivo);
      if (!v.ok) { console.error(`❌ ${v.error}`); process.exit(2); }
      const [row] = await s`
        UPDATE public.backlog_tasks SET due_at = ${new Date(fecha)}, due_reason = ${motivo}
         WHERE id = ${id} AND status IN ('open','in_progress','blocked')
        RETURNING id, title, due_at, due_reason`;
      if (!row) { console.error(`❌ ${id} no existe o está cerrada`); process.exit(1); }
      const p = clasificarPlazo(row.due_at, new Date());
      console.log(`${p.icono} ${row.id} VENCE ${cuando(row.due_at)} (${p.etiqueta}) — ${row.title}`);
      console.log(`   motivo: ${row.due_reason}`);
      console.log('   (sale la PRIMERA en `list`; pasado el plazo no se pospone sola: se decide)');
    }

    else if (cmd === 'snooze') {
      const id = process.argv[3];
      if (!id) { console.error('Uso: backlog.cjs snooze <T-xxx> --hasta <ISO|YYYY-MM-DD HH:MM> | --horas N | --dias N --motivo "…"'); process.exit(2); }
      const motivo = arg('--motivo') || arg('--reason');
      // El motivo es OBLIGATORIO: un aplazamiento sin explicación es indistinguible de un
      // olvido, y la sesión que lo vea dentro de tres días no sabrá si ya toca o no.
      if (!motivo) { console.error('❌ falta --motivo "por qué espera y qué se mira al despertar"'); process.exit(2); }
      let hasta;
      try { hasta = parseHasta(); } catch (e) { console.error(`❌ ${e.message}`); process.exit(2); }
      if (hasta.getTime() <= Date.now()) { console.error(`❌ ${hasta.toISOString()} ya pasó — un aplazamiento al pasado no aplaza nada`); process.exit(2); }
      const [row] = await s`
        UPDATE public.backlog_tasks
           SET snooze_until = ${hasta}, snooze_reason = ${motivo}, snoozed_by = ${sid || 'cli'},
               snooze_count = COALESCE(snooze_count, 0) + 1
         WHERE id = ${id} AND status IN ('open','in_progress','blocked')
        RETURNING id, title, snooze_count`;
      if (!row) { console.error(`❌ ${id} no existe o está cerrada`); process.exit(1); }
      console.log(`🕒 ${row.id} EN ESPERA hasta ${cuando(hasta)} — ${row.title}`);
      console.log(`   motivo: ${motivo}`);
      console.log('   (no la sugiere `next` NI la deja coger `claim`; se despierta sola)');
      if (isChronicSnooze(row)) console.log(`   🔁 van ${row.snooze_count} aplazamientos: replantéate si es una tarea programada o una decisión que nadie toma.`);
    }

    else if (cmd === 'pause') {
      // La operación que faltaba: aplazar una tarea que YA has empezado.
      //
      // Hoy las dos salidas eran malas: `release` borra que estaba a medias (el siguiente
      // empieza de cero) y `snooze` conservando el claim deja el lease muriéndose solo —medido
      // el 29/07: 3 tareas in_progress con el lease caducado, una desde hacía 32 h—. `pause`
      // hace las tres cosas a la vez: suelta el claim, pone el reloj y deja escrito dónde se
      // quedó, que es lo único que hace útil retomarla dentro de dos semanas.
      needSid();
      const id = process.argv[3];
      const hecho = arg('--hecho');
      const falta = arg('--falta');
      if (!id || !hecho || !falta) {
        console.error('Uso: backlog.cjs pause <T-xxx> --hasta <ISO|YYYY-MM-DD HH:MM>|--horas N|--dias N --hecho "qué queda hecho" --falta "qué hay que verificar al despertar"');
        console.error('   Las dos notas son OBLIGATORIAS: una pausa sin ellas es indistinguible de un abandono.');
        process.exit(2);
      }
      // Dos formas de esperar, y NO son la misma:
      //   --hasta/--horas/--dias  → un RELOJ (la cosecha del cron, la fecha en que toca medir)
      //   --tras-deploy [sha]     → una CONDICIÓN ("mi commit ya está vivo"), que es el caso más
      //                             común de "hecho pero sin verificar" y no tiene fecha.
      const trasDeploy = process.argv.includes('--tras-deploy');
      let hasta = null;
      let shaEsperado = null;
      let superficie = arg('--superficie') || arg('--surface') || 'both';
      if (trasDeploy) {
        if (!['frontend', 'backend', 'both'].includes(superficie)) {
          console.error('❌ --superficie debe ser frontend | backend | both'); process.exit(2);
        }
        shaEsperado = arg('--tras-deploy') || (() => {
          try {
            const { execFileSync } = require('child_process');
            return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
          } catch { return null; }
        })();
        if (!shaEsperado) { console.error('❌ no pude resolver el commit — pásalo: --tras-deploy <sha>'); process.exit(2); }
      } else {
        try { hasta = parseHasta(); } catch (e) { console.error(`❌ ${e.message}`); process.exit(2); }
        if (hasta.getTime() <= Date.now()) { console.error(`❌ ${hasta.toISOString()} ya pasó — una pausa al pasado no pausa nada`); process.exit(2); }
      }
      const [row] = await s`
        UPDATE public.backlog_tasks
           SET snooze_until = ${hasta},
               wake_on_deploy_sha = ${shaEsperado},
               wake_on_deploy_surface = ${shaEsperado ? superficie : null},
               snooze_reason = ${`retomar: ${falta}`},
               snoozed_by = ${sid},
               snooze_count = COALESCE(snooze_count, 0) + 1,
               progress_note = ${hecho},
               resume_check = ${falta},
               -- suelta el claim: que no quede un lease agonizando durante días
               -- Acumular lo trabajado ANTES de soltar el claim (T-414): hasta hoy esto ponía
               -- claimed_at a NULL y con ello se BORRABA el único dato que permite contrastar
               -- una estimación de esfuerzo. Medido antes del cambio: 0 tareas con duración
               -- medible en todo el backlog.
               worked_seconds = COALESCE(worked_seconds, 0)
                              + GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (now() - claimed_at))::int, 0)),
               claimed_by = NULL, claimed_at = NULL, lease_until = NULL,
               status = CASE WHEN status = 'in_progress' THEN 'open' ELSE status END
         WHERE id = ${id} AND status IN ('open','in_progress','blocked')
           AND (claimed_by = ${sid} OR claimed_by IS NULL OR lease_until < now())
        RETURNING id, title, snooze_count`;
      if (!row) { console.error(`❌ no pude pausar ${id} (¿no existe, está cerrada o la tiene otra sesión?)`); process.exit(1); }
      console.log(shaEsperado
        ? `⏸  ${row.id} EN PAUSA hasta que se despliegue ${shaEsperado.slice(0, 8)} (${superficie}) — ${row.title}`
        : `⏸  ${row.id} EN PAUSA hasta ${cuando(hasta)} — ${row.title}`);
      console.log(`   ✔ hecho:  ${hecho}`);
      console.log(`   ▶ falta:  ${falta}`);
      console.log(shaEsperado
        ? '   (claim liberado · la despierta el propio deploy al terminar, o `backlog.cjs deployed <sha>`)'
        : '   (claim liberado · no la sugiere `next` ni la deja coger `claim` · despierta sola)');
      if (isChronicSnooze(row)) console.log(`   🔁 van ${row.snooze_count} aplazamientos: ¿tarea programada o decisión pendiente?`);
    }

    // ── LA QUINTA ESPERA: hecho y esperando que una PERSONA lo mire (T-539) ─────────────────
    // Nace de la 1ª vuelta del piloto de flota: el trabajador terminó su auditoría, dejó una
    // propuesta lista para revisar y NO TENÍA COMANDO con el que decirlo. Acabó en
    // `pause --hasta "2026-08-06 09:00"` con una fecha inventada, porque su bloqueo no era el
    // reloj. Con trabajadores autónomos éste va a ser el estado final MÁS FRECUENTE.
    //
    // Suelta el claim, como `pause`: quien entrega ya no la está trabajando, y un lease agonizando
    // sobre algo terminado impide que la coja quien vaya a revisarla.
    else if (cmd === 'revision') {
      needSid();
      const id = process.argv[3];
      const entrega = arg('--entrega');
      const v = REV.validarEntrega(entrega);
      if (!id || !v.ok) {
        console.error('Uso: backlog.cjs revision <T-xxx> --entrega "QUÉ hay que revisar y DÓNDE está"');
        if (v.problema) console.error(`   ❌ ${v.problema}`);
        console.error('   La entrega es OBLIGATORIA: quien revisa no puede adivinar qué se espera de él,');
        console.error('   y con varios trabajadores entregando a la vez la revisión es el recurso escaso.');
        process.exit(2);
      }
      const [prev] = await s`SELECT id, title, status FROM public.backlog_tasks WHERE id = ${id}`;
      if (!prev) { console.error(`❌ ${id} no existe.`); process.exit(1); }
      if (['done', 'cancelled'].includes(prev.status)) {
        console.error(`❌ ${id} ya está cerrada (${prev.status}): no hay nada que revisar.`);
        process.exit(2);
      }
      const [row] = await s`
        UPDATE public.backlog_tasks
           SET review_requested_at = now(),
               review_note         = ${entrega},
               review_requested_by = ${sid},
               -- El tiempo trabajado se acumula ANTES de soltar el claim, igual que en release:
               -- si no, se pierde el único dato con el que contrastar la estimación (T-414).
               -- (sin comillas invertidas aquí dentro: esto es una plantilla de JS y las cierra)
               worked_seconds = COALESCE(worked_seconds, 0)
                              + GREATEST(0, COALESCE(EXTRACT(EPOCH FROM (now() - claimed_at))::int, 0)),
               claimed_by = NULL, claimed_at = NULL, lease_until = NULL,
               status = CASE WHEN status = 'in_progress' THEN 'open' ELSE status END
         WHERE id = ${id} RETURNING id, title`;
      console.log(`🙋 ${row.id} ENTREGADA — esperando revisión humana.`);
      console.log(`   ${row.title}`);
      console.log(`   ▶ ${entrega}`);
      console.log(`   Sale en 'list' y en 'npm run parte' bajo 🙋. Nadie la coge sin --force,`);
      console.log(`   y no se despierta sola: la despierta una persona ('wake ${row.id}').`);
    }

    else if (cmd === 'verificado') {
      // GEMELO DE `pause` (T-449). `pause` dice «aún no se puede comprobar»; esto dice «ya lo
      // comprobé, y la tarea sigue viva». Sin este verbo no había forma de decirlo: `done` la
      // cerraría en falso, `pause` obligaría a inventarse una espera que no existe, y `release`
      // no toca `resume_check` —así que la suelta con el pendiente obsoleto intacto y el
      // siguiente que llegue tropieza igual—.
      //
      // NO reparte la columna entre dos criterios: `pause` sigue siendo el ÚNICO que ESCRIBE
      // `resume_check`; esto solo lo CUMPLE y lo vacía. Dos escritores con criterios distintos
      // es como nació el quinto escritor de `seguimiento_url` [T-130].
      needSid();
      const id = process.argv[3];
      const nota = arg('--nota');
      if (!id || !nota) {
        console.error('Uso: backlog.cjs verificado <T-xxx> --nota "QUÉ comprobaste y con qué evidencia"');
        console.error('   La nota es OBLIGATORIA: sin ella, «verificado» es indistinguible de «lo doy por bueno».');
        process.exit(2);
      }
      const [prev] = await s`
        SELECT id, title, status, resume_check, progress_note, claimed_by, lease_until,
               wake_on_deploy_sha, snooze_until
          FROM public.backlog_tasks WHERE id = ${id}`;
      if (!prev) { console.error(`❌ ${id} no existe.`); process.exit(1); }
      const veredicto = puedeMarcarseVerificada(prev, sid);
      if (!veredicto.ok) {
        console.error(`❌ ${id} no se puede marcar verificada: ${veredicto.motivo}.`);
        process.exit(2);
      }
      // El pendiente CUMPLIDO no se borra: baja a `progress_note` con la nota de qué se comprobó.
      // Borrarlo dejaría la tarea sin rastro de que hubo una verificación, que es justo lo que
      // hace falta para no repetirla.
      const [row] = await s`
        UPDATE public.backlog_tasks
           SET resume_check = NULL,
               snooze_reason = NULL,
               progress_note = concat_ws(E'\n',
                 ${'VERIFICADO: ' + nota}::text,
                 ${'(lo que estaba pendiente de comprobar era: ' + String(prev.resume_check).slice(0, 400) + ')'}::text,
                 progress_note)
         WHERE id = ${id} RETURNING id, title`;
      console.log(`✅ ${row.id} marcada VERIFICADA — ${row.title}`);
      console.log(`   ✔ comprobado: ${nota}`);
      console.log('   Sale de «⏰ IMPLEMENTADAS Y SIN COMPROBAR» y queda como una tarea abierta normal.');
      console.log('   Si ya no queda trabajo, ciérrala:  node scripts/backlog.cjs done ' + id + ' --outcome "…"');
    }

    else if (cmd === 'deployed') {
      // Lo llama el propio script de deploy al terminar (best-effort, nunca rompe un deploy).
      // Comparte implementación con la reconciliación perezosa de `list`: dos copias acabarían
      // despertando con criterios distintos y el desacuerdo sería invisible.
      const sha = process.argv[3];
      const superficie = arg('--superficie') || arg('--surface') || 'both';
      if (!sha) { console.error('Uso: backlog.cjs deployed <sha> [--superficie frontend|backend|both]'); process.exit(2); }
      const shas = superficie === 'both'
        ? { frontend: sha, backend: sha }
        : { frontend: null, backend: null, [superficie]: sha };
      const r = await despertarPorDeploy(s, shas, { verboso: true });
      if (!r.esperaban) console.log('(ninguna tarea esperaba un deploy)');
      else if (!r.despertadas) console.log(`(${r.esperaban} esperando deploy, ninguna incluida todavía en ${String(sha).slice(0, 8)})`);
    }

    else if (cmd === 'wake') {
      const id = process.argv[3];
      if (!id) { console.error('Uso: backlog.cjs wake <T-xxx>'); process.exit(2); }
      // El estado ANTERIOR se lee antes de tocarla: `RETURNING` devuelve la fila ya actualizada,
      // así que preguntarle ahí si estaba en revisión daría siempre «no».
      const [antes] = await s`
        SELECT (review_requested_at IS NOT NULL) AS en_revision FROM public.backlog_tasks WHERE id = ${id}`;
      const [row] = await s`
        UPDATE public.backlog_tasks
           SET snooze_until = NULL, snooze_reason = NULL, snoozed_by = NULL,
               -- wake es «vuelve al pool», y la espera de REVISIÓN también se levanta aquí
               -- (T-539): un verbo nuevo para lo mismo obligaría a saber cuál de las esperas la
               -- tenía parada antes de poder despertarla.
               -- (sin comillas invertidas aquí dentro: esto es una plantilla de JS y las cierra)
               review_requested_at = NULL, review_note = NULL, review_requested_by = NULL
         WHERE id = ${id} RETURNING id, title`;
      if (!row) { console.error(`❌ ${id} no existe`); process.exit(1); }
      console.log(`⏰ ${row.id} despierta — ${row.title}`);
      if (antes && antes.en_revision) console.log('   (estaba esperando revisión humana: queda libre para cogerla)');
    }

    else if (cmd === 'reserve') {
      const titulo = process.argv[3] || 'RESERVADA — ficha pendiente de escribir en el markdown';

      // ── GUARDARRAÍL: NINGUNA FICHA NUEVA NACE SIN ESFUERZO DECLARADO (T-414) ──────────────
      // Regla de Manuel, 31/07: «que todo tenga guardarraíl, porque si no, por mucho que lo
      // digas, si no se obliga no se hace y el listado de tareas se descontrola».
      //
      // Va AQUÍ y no en un test de CI a propósito: el esfuerzo vive en la BD, así que el CI —que
      // corre sin base de datos— no puede verlo. El único punto donde se puede EXIGIR es el
      // momento de crear la ficha, que además es cuando quien la escribe tiene el juicio fresco.
      // Es la misma decisión que T-387: impedir en el punto de escritura en vez de detectar tarde.
      //
      // Solo se exige a las NUEVAS. Las 182 que ya existen se declaran cuando alguien las toque:
      // obligar retroactivamente sería una tarde de rellenar campos a ojo, que es justo cómo se
      // consigue un campo lleno de datos falsos.
      const esfuerzo = arg('--esfuerzo') || arg('--effort');
      if (!ESF.esValido(esfuerzo)) {
        console.error('❌ falta --esfuerzo: una ficha sin esfuerzo declarado no se puede triar,');
        console.error('   y el listado se descontrola. Elige el cajón (no son horas, es la DECISIÓN que habilita):');
        for (const c of ESF.CAJONES) console.error(`     --esfuerzo ${c.padEnd(14)} ${ESF.DESCRIPCION[c]}`);
        console.error('\n   Ej:  node scripts/backlog.cjs reserve "Título" --esfuerzo rato');
        process.exit(2);
      }

      // ── GUARDARRAÍL ANTI-DUPLICADO (T-359, 31/07) ─────────────────────────────────────────
      // El 31/07 una sesión empezó a construir un lote de 385 ofertas de precio que OTRA había
      // terminado y verificado el día antes (T-341 vs T-343). No lo detectó ningún proceso: lo
      // detectó Manuel preguntando. El claim impide que dos sesiones cojan la MISMA ficha, no que
      // se creen dos fichas para el mismo trabajo — y `list` solo enseña lo ABIERTO, así que una
      // tarea cerrada ayer es justo la que no se ve.
      //
      // Avisa con 4 palabras distintivas en común y EXIGE motivo escrito con 5. Calibrado sobre
      // los 359 títulos reales: avisa en el 21% y exige motivo en el 9%. El caso que lo motivó
      // compartía 5 («boton», «vaciado», «stripe», «oferta», «avisar»), así que habría parado.
      // Avisa en vez de bloquear en la banda baja a propósito: un guardarraíl que aborta por
      // parecido léxico se acaba esquivando, y entonces no protege nada.
      if (process.argv[3]) {
        const { fichasParecidas } = require(path.join(__dirname, '..', 'lib', 'backlog', 'fichaDuplicada.cjs'));
        const universo = await s`
          SELECT id, title, status, outcome FROM public.backlog_tasks
           WHERE status <> 'done' OR closed_at > now() - interval '60 days'`;
        const parecidas = fichasParecidas(titulo, universo, { minComunes: 4 });
        const fuertes = parecidas.filter((p) => p.comunes.length >= 5);
        if (parecidas.length) {
          console.log(`\n⚠️  Ya hay ficha(s) que se parecen a lo que vas a crear — LÉELAS antes de escribir nada:`);
          for (const p of parecidas.slice(0, 3)) {
            console.log(`   · ${p.id} [${p.status}] ${String(p.title).slice(0, 78)}`);
            console.log(`       comparten: ${p.comunes.join(', ')}`);
          }
        }
        if (fuertes.length && !arg('--aunque')) {
          console.error(`\n❌ NO reservado: ${fuertes[0].id} se parece demasiado (${fuertes[0].comunes.length} palabras).`);
          console.error('   Si de verdad es otra cosa, dilo por escrito y queda registrado:');
          console.error(`     node scripts/backlog.cjs reserve "${String(titulo).slice(0, 40)}…" --aunque "en qué se diferencia de ${fuertes[0].id}"`);
          process.exit(3);
        }
        if (fuertes.length) {
          try {
            await s`INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
                    VALUES (gen_random_uuid(), now(), 'backlog:reserve', 'info', 'backlog_ficha_parecida_ignorada',
                            ${JSON.stringify({ titulo, parecidas: fuertes.map((f) => f.id), motivo: arg('--aunque'), sid })}::jsonb, now())`;
          } catch { /* el rastro es un extra, no una precondición */ }
        }
      }
      // Se reintenta por si otra sesión gana la carrera entre el SELECT y el INSERT:
      // la unicidad la garantiza la PK, no este cálculo.
      let reservado = null;
      for (let intento = 0; intento < 10 && !reservado; intento++) {
        const filas = await s`SELECT id FROM public.backlog_tasks`;
        // La numeración vive en `lib/backlog/siguienteId.cjs` (núcleo puro con tests): SOLO votan
        // los ids con forma `T-NNN`. Antes se le quitaban los no-dígitos a CUALQUIER id y un
        // canario llamado `CANARY-coord-20450` hizo nacer la ficha siguiente como T-20451.
        const { siguienteId } = require(require('path').join(__dirname, '..', 'lib', 'backlog', 'siguienteId.cjs'));
        const siguiente = siguienteId(filas).siguiente;
        const [r] = await s`
          INSERT INTO public.backlog_tasks (id, title, priority, status, effort)
          VALUES (${siguiente}, ${titulo}, 'media', 'open', ${esfuerzo})
          ON CONFLICT (id) DO NOTHING RETURNING id`;
        if (r) reservado = r.id;
      }
      if (!reservado) { console.error('❌ no se pudo reservar un id tras 10 intentos'); process.exit(2); }
      console.log(`✅ id reservado: ${reservado}`);
      console.log(`   escribe la ficha y COLÓCALA con la herramienta (a mano se coloca mal — T-515):`);
      console.log(`     node scripts/backlog.cjs ficha ${reservado} --texto <fichero.md>`);
      console.log(`     (o por stdin:  … | node scripts/backlog.cjs ficha ${reservado})`);
      console.log(`   empieza el fichero por:  ### [${reservado}] 🟡 [ABIERTO …] <título>`);
      console.log(`   y luego:  node scripts/backlog.cjs sync   (actualizará el título real)`);
    }

    // ── COLOCAR UNA FICHA NUEVA (T-515) ──────────────────────────────────────────────────────
    // A mano se coloca mal. `tareas-pendientes.md` pasa de 11.000 líneas y la frase «## Abiertas»
    // sale DENTRO del texto de varias fichas, así que cualquier búsqueda de esa cadena acierta la
    // mención antes que el encabezado y la ficha acaba en el preámbulo, fuera de toda sección.
    // Pasó dos veces; la segunda, el ancla falsa era un bullet de otra sesión avisando de esto
    // mismo — o sea que el aviso escrito no lo evita. El criterio vive en `lib/backlog/insertarFicha.cjs`.
    else if (cmd === 'ficha') {
      const id = process.argv[3];
      if (!id) { console.error('❌ uso: node scripts/backlog.cjs ficha T-042 [--texto <fichero.md>]'); process.exit(1); }
      const { insertarFicha } = require('../lib/backlog/insertarFicha.cjs');
      const fTexto = arg('--texto');
      let bloque = '';
      try {
        bloque = fTexto ? fs.readFileSync(fTexto, 'utf8') : fs.readFileSync(0, 'utf8');
      } catch (e) {
        console.error(`❌ no se pudo leer la ficha: ${e.message}`);
        process.exit(1);
      }

      // El id tiene que estar RESERVADO. La BD es el árbitro del reparto (el markdown no admite
      // reserva atómica), así que escribir una ficha con un id que nadie reservó es cómo se
      // pisan dos sesiones — el mismo fallo que `reserve` vino a cerrar.
      const [fila] = await s`SELECT id, title FROM public.backlog_tasks WHERE id = ${id}`;
      if (!fila) {
        console.error(`❌ ${id} no está reservado en backlog_tasks. Resérvalo antes:`);
        console.error(`     node scripts/backlog.cjs reserve "<título>" --esfuerzo <cajón>`);
        process.exit(3);
      }

      const md = fs.readFileSync(MD, 'utf8');
      const r = insertarFicha(md, id, bloque);
      if (!r.ok) {
        console.error(`❌ NO insertada (${r.motivo}): ${r.detalle}`);
        process.exit(2);
      }
      fs.writeFileSync(MD, r.md);
      console.log(`✅ ficha ${id} colocada bajo «## Abiertas» (línea ${r.linea}) — ninguna ficha previa se ha perdido`);
      console.log(`   ahora:  node scripts/backlog.cjs sync`);
    }

    // ── DEVOLVER A SU SECCIÓN LAS FICHAS HUÉRFANAS (T-515) ───────────────────────────────────
    // El rastro acumulado de insertar a mano: 58 fichas fuera de toda sección el 04/08, 27 de
    // ellas VIVAS y cinco 🔴. El CLI las sigue viendo (manda la cabecera, no la posición), pero
    // quien abre el fichero y baja a «## Abiertas» no las encuentra.
    else if (cmd === 'reubicar') {
      const { reubicarHuerfanas } = require('../lib/backlog/insertarFicha.cjs');
      // `arg()` devuelve null a un flag SIN valor (es su contrato, documentado arriba). Los
      // booleanos van por `includes`, como `--all` y el `--apply` de `reap`. Escrito con
      // `arg('--apply')` no aplicaba nunca — falló hacia el lado seguro, pero no hacía su trabajo.
      const APLICAR = process.argv.includes('--apply');
      const md = fs.readFileSync(MD, 'utf8');
      const r = reubicarHuerfanas(md);
      if (!r.ok) { console.error(`❌ no se ha tocado nada (${r.motivo})`); process.exit(2); }
      if (!r.movidas.length) {
        console.log('✅ ninguna ficha VIVA fuera de sección.');
        if (r.dejadas.length) console.log(`   (${r.dejadas.length} cerradas huérfanas: se dejan — su sitio sería «## Hechas» y hay tres)`);
        return;
      }
      console.log(`${APLICAR ? '✍️  moviendo' : '🔍 SIMULACIÓN (usa --apply para escribir)'} ${r.movidas.length} ficha(s) VIVA(s) al final de «## Abiertas»:`);
      for (const id of r.movidas) console.log(`   · ${id}`);
      if (r.dejadas.length) console.log(`   (${r.dejadas.length} cerradas huérfanas se quedan donde están, a propósito)`);
      if (APLICAR) {
        fs.writeFileSync(MD, r.md);
        console.log('✅ escrito. Ninguna ficha se ha perdido (comprobado antes de escribir).');
      }
    }

    // ── EL EMBUDO DE PREGUNTAS (T-493) ───────────────────────────────────────────────────────
    // Manuel no puede entrar en 2-10 terminales a ver si alguien le necesita. Antes de esto una
    // duda moría en la terminal, o se colaba en el `resume_check` de una tarea PAUSADA donde
    // `clasificarEspera` la buscaba con cinco expresiones regulares — y si la sesión no escribía
    // la palabra correcta, la pregunta desaparecía de la lista.
    else if (cmd === 'preguntar') {
      const pregunta = process.argv[3];
      const contexto = arg('--contexto');
      const tarea = arg('--tarea');
      const bloquea = process.argv.includes('--bloquea');
      const v = PREG.validarPregunta({ question: pregunta, context: contexto, blocking: bloquea });
      if (!v.ok) {
        console.error('❌ esa pregunta no se puede contestar sin abrir tu sesión:');
        for (const p of v.problemas) console.error(`   · ${p}`);
        console.error('\n   Ej:  node scripts/backlog.cjs preguntar "¿el barrido entra también en las rutas que sirven preguntas, o lo dejo solo en públicas?" \\');
        console.error('          --contexto "Medido: 168 formas; las de test alimentan el antifraude" --tarea T-487');
        process.exit(2);
      }
      if (tarea) {
        const [t] = await s`SELECT id FROM public.backlog_tasks WHERE id = ${tarea}`;
        if (!t) { console.error(`❌ la tarea ${tarea} no existe`); process.exit(2); }
      }
      const [r] = await s`
        INSERT INTO public.session_questions (sid, task_id, question, context, blocking)
        VALUES (${sid}, ${tarea || null}, ${pregunta}, ${contexto || null}, ${bloquea})
        RETURNING id`;
      console.log(`🙋 pregunta #${r.id} en el embudo${bloquea ? ' — marcada como BLOQUEANTE' : ''}.`);
      // Preguntar NO para a la sesión (avisar ≠ bloquear). Si de verdad no se puede avanzar, eso
      // ya tiene nombre en el sistema y hay que decirlo, no dejarlo implícito en el tono.
      console.log(bloquea
        ? '   Si no puedes avanzar en NADA, suelta la tarea:  backlog.cjs pause <id> --hasta … --hecho "…" --falta "…"'
        : '   Sigue con otra cosa: la respuesta te la enseña cualquier comando del backlog.');
    }

    // ── BORRADORES: lo que se le enviaría a una persona, esperando el OK de Manuel (T-486) ───
    // «Siempre tengo que aprobar lo que se envía, porque ahí se detectan fallos y los usuarios
    // necesitan que haya personas detrás, no la IA.» Los tres scripts que envían ya se niegan si
    // el rol no es `persona`; esto es lo OTRO que hacía falta: dónde va lo redactado. Sin un
    // sitio, el borrador muere en el log de una terminal que nadie mira — el mismo fallo que el
    // embudo cerró para las preguntas, por eso va por el MISMO canal y no por una cola nueva.
    else if (cmd === 'borrador') {
      const para = arg('--para');
      const fichero = arg('--texto');
      const tarea = arg('--tarea');
      const resumen = arg('--resumen');
      if (!para || !fichero) {
        console.error('uso: node scripts/backlog.cjs borrador --para "<a quién>" --texto <fichero.md> [--tarea T-nnn] [--resumen "…"]');
        console.error('   El fichero lleva el mensaje ÍNTEGRO tal y como se enviaría. Manuel lo lee y decide.');
        process.exit(1);
      }
      let cuerpo = '';
      try { cuerpo = fs.readFileSync(fichero, 'utf8'); }
      catch (e) { console.error(`❌ no se pudo leer ${fichero}: ${e.message}`); process.exit(1); }
      if (cuerpo.trim().length < 40) {
        console.error('❌ eso no es un mensaje (menos de 40 caracteres). Un borrador se aprueba leyéndolo entero.');
        process.exit(2);
      }
      if (tarea) {
        const [t] = await s`SELECT id FROM public.backlog_tasks WHERE id = ${tarea}`;
        if (!t) { console.error(`❌ la tarea ${tarea} no existe`); process.exit(2); }
      }
      // ── UN BORRADOR POR DESTINATARIO ───────────────────────────────────────────────────
      // El claim de la cola protege el trabajo SIMULTÁNEO; nada protegía el YA HECHO. Al terminar,
      // el trabajador suelta la fila (hace bien: no puede cerrarla) y vuelve al pool, así que el
      // siguiente la re-analiza desde cero. Medido al estrenarlo: de los diez primeros borradores,
      // TRES pares duplicados. El coste no es la cuota — es que Manuel tenga que decidir cuál de
      // los dos mandar, que es justo el trabajo que la flota venía a ahorrarle.
      const BORR = require('../lib/backlog/borradores.cjs');
      if (!process.argv.includes('--igualmente')) {
        const abiertos = await s`
          SELECT id, draft_target, sid FROM public.session_questions
           WHERE kind = 'borrador' AND status = 'open'`;
        const dup = BORR.yaHayUno(para, abiertos);
        if (dup.duplicado) { console.error(BORR.mensajeDuplicado(dup)); process.exit(3); }
      }

      // El «question» es lo que Manuel ve en una línea; el cuerpo íntegro va en `context`.
      const titular = (resumen || `Borrador para ${para}: ¿lo apruebo tal cual?`).trim();
      const [r] = await s`
        INSERT INTO public.session_questions (sid, task_id, kind, draft_target, question, context, blocking)
        VALUES (${sid}, ${tarea || null}, 'borrador', ${para}, ${titular}, ${cuerpo}, false)
        RETURNING id`;
      console.log(`📝 borrador #${r.id} en el embudo, esperando el OK de Manuel.`);
      console.log(`   Para: ${para}`);
      console.log('   NO lo envíes tú: lo que sale hacia una persona lo aprueba y lo manda una persona.');
      console.log('   Lo verá en «npm run flota» y en «backlog.cjs preguntas».');
    }

    else if (cmd === 'preguntas') {
      const todas = process.argv.includes('--todas');
      const filas = await s`
        SELECT q.*, t.title AS tarea_titulo
          FROM public.session_questions q
          LEFT JOIN public.backlog_tasks t ON t.id = q.task_id
         WHERE ${todas ? s`true` : s`q.status = 'open'`}
         ORDER BY q.asked_at DESC LIMIT 60`;
      if (!filas.length) { console.log('✅ no hay preguntas pendientes.'); }
      else if (!todas) {
        for (const l of PREG.formatearEmbudo(filas)) console.log(l);
        console.log('');
        // El detalle va DEBAJO del listado: lo que se contesta rápido primero, el contexto para
        // quien lo necesite. Sin el contexto, contestar obliga a abrir la sesión.
        for (const p of PREG.ordenarEmbudo(filas)) {
          console.log(`── #${p.id}${p.task_id ? ` · ${p.task_id} — ${String(p.tarea_titulo || '').slice(0, 60)}` : ''}${p.blocking ? ' · ⛔ PARADA' : ''}`);
          console.log(`   ${p.question}`);
          if (p.context) console.log(`   contexto: ${p.context}`);
          console.log(`   sesión ${String(p.sid).slice(0, 12)}… · ${PREG.esperaHoras(p)}h esperando`);
        }
      } else {
        for (const p of filas) {
          console.log(`#${p.id} [${p.status}] ${String(p.question).slice(0, 80)}`);
          if (p.answer) console.log(`   → ${String(p.answer).slice(0, 100)}`);
        }
      }
    }

    else if (cmd === 'responder') {
      const id = process.argv[3];
      const texto = arg('--respuesta') || process.argv[4];
      if (!id || !texto) { console.error('Uso: backlog.cjs responder <id> "la respuesta"'); process.exit(2); }
      const [r] = await s`
        UPDATE public.session_questions
           SET answer = ${texto}, answered_at = now(), answered_by = 'manuel', status = 'answered'
         WHERE id = ${Number(id)} AND status = 'open'
        RETURNING id, sid, task_id, question`;
      if (!r) { console.error(`❌ la pregunta #${id} no existe o ya está cerrada`); process.exit(2); }
      console.log(`✅ #${r.id} respondida. La sesión ${String(r.sid).slice(0, 12)}… la verá en su próximo comando del backlog.`);
    }

    else if (cmd === 'retirar') {
      const id = process.argv[3];
      const motivo = arg('--motivo');
      // El motivo es obligatorio: una pregunta que desaparece sin explicación es indistinguible
      // de una que se perdió, y perder preguntas es justo lo que este canal existe para evitar.
      if (!id || !motivo) { console.error('Uso: backlog.cjs retirar <id> --motivo "lo resolví solo porque…"'); process.exit(2); }
      const [r] = await s`
        UPDATE public.session_questions
           SET status = 'withdrawn', withdrawn_reason = ${motivo}, answered_at = now()
         WHERE id = ${Number(id)} AND sid = ${sid} AND status = 'open'
        RETURNING id`;
      if (!r) { console.error(`❌ #${id} no existe, no es tuya o ya está cerrada`); process.exit(2); }
      console.log(`✅ #${r.id} retirada: ${motivo}`);
    }

    else {
      console.log('Uso: backlog.cjs list [--all] | next | claim <id> | heartbeat | mine | done <id> --outcome "…" | reopen <id> --motivo "…" | release <id> | snooze <id> --hasta|--horas|--dias --motivo "…" | pause <id> (--hasta …|--tras-deploy [sha] [--superficie frontend|backend|both]) --hecho "…" --falta "…" | verificado <id> --nota "…" | revision <id> --entrega "…" | deployed <sha> --superficie … | wake <id> | due <id> --fecha "…" --motivo "…" | reserve ["título"] [--aunque "…"] | ficha <id> [--texto <fichero.md>] | reubicar [--apply] | reap [--horas N] [--apply] | esfuerzo <id> <minutos|rato|larga|sesion_propia> | sync\n     preguntas: preguntar "…" [--contexto "…"] [--tarea T-nnn] [--bloquea] | preguntas [--todas] | responder <id> "…" | retirar <id> --motivo "…"');
    }
  } catch (e) {
    console.error('❌', e.message);
    process.exitCode = 1;
  } finally {
    await s.end();
  }
})();
