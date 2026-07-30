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
const path = require('path');
// Driver perezoso y por resolucion normal: una ruta ABSOLUTA/cableada rompe el script
// en CI y en cualquier maquina que no sea la de Manuel. `postgres` esta en la raiz.
const loadPg = () => require('postgres');
// La decisión de si una tarea se puede coger vive en un solo sitio, compartida con los tests.
const { claimGate, isChronicSnooze, deployWakeReady, isAwaitingVerification, clasificarEspera, detectarTrabajoPendiente } = require(path.join(__dirname, '..', 'lib', 'backlog', 'claimGate.cjs'));

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
function estuvoEnElHistorial(id) {
  try {
    const { execFileSync } = require('child_process');
    const out = execFileSync(
      'git', ['log', '--format=%h', '-S', `### [${id}]`, '--', MD_REL],
      { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15_000 });
    return out.trim().length > 0;
  } catch {
    return false;
  }
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
function readSessionId() {
  for (const p of [path.join(process.cwd(), '.session-id'), path.join(REPO, '.session-id')]) {
    try { const v = fs.readFileSync(p, 'utf8').trim(); if (v) return v; } catch {}
  }
  return null;
}

const cmd = process.argv[2];
const sid = arg('--sid') || readSessionId() || process.env.CLAUDE_CODE_SESSION_ID || null;
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
const enEsperaAlguna = (r) => dormida(r) || esperandoDeploy(r);

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

// Parseo del markdown: mismo formato que lib/backlog/claim.ts (### [T-042] 🔴 Título)
function parseMd() {
  const md = fs.readFileSync(MD, 'utf8');
  const out = []; let inOpen = false;
  const E2P = { '🔴': 'critica', '🟠': 'alta', '🟡': 'media', '🟢': 'baja', '⬜': 'ninguna' };
  for (const line of md.split('\n')) {
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) { inOpen = /abiertas/i.test(h2[1]); continue; }
    const h3 = /^###\s+(.*)$/.exec(line);
    if (!h3) continue;
    const idM = /\[(T-\d+)\]/.exec(h3[1]);
    if (!idM) continue;
    const emoji = Object.keys(E2P).find((e) => h3[1].includes(e));
    const title = h3[1].replace(/\[(T-\d+)\]/, '').replace(/[🔴🟠🟡🟢⬜✅]/g, '')
      .replace(/^\s*\[[^\]]*\]\s*/, '').trim();
    out.push({ id: idM[1], title, priority: emoji ? E2P[emoji] : 'media', inOpenSection: inOpen, doneMarked: h3[1].includes('✅') });
  }
  return out;
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
    await s`UPDATE public.backlog_tasks
               SET wake_on_deploy_sha = NULL, wake_on_deploy_surface = NULL
             WHERE id = ${t.id}`;
    ids.push(t.id);
    if (opts.verboso) console.log(`⏰ ${t.id} DESPERTADA — ya se puede verificar: ${t.resume_check || t.title}`);
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
               snooze_until, snooze_reason, snooze_count, resume_check,
               wake_on_deploy_sha, wake_on_deploy_surface
          FROM public.backlog_tasks
         ${all ? s`` : s`WHERE status IN ('open','in_progress','blocked')`}
         ORDER BY CASE priority WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baja' THEN 3 ELSE 9 END, id`;
      // LO PRIMERO que se ve al pedir las tareas pendientes: lo que se puede cerrar YA.
      // Antes salía al final, detrás de 100+ líneas, y por eso T-273 llevaba 16 h esperando y
      // T-270 estaba perdiendo su ventana de medición sin que nadie lo supiera (30/07).
      // Se separan dos cosas que se atienden distinto: lo que verificamos nosotros y lo que
      // espera una decisión de Manuel — que por muy despierta que esté, Claude no puede cerrar.
      const listas = rows.filter((r) => isAwaitingVerification(r));
      const paraVerificar = listas.filter((r) => clasificarEspera(r.resume_check) === 'verificacion');
      const paraManuel = listas.filter((r) => clasificarEspera(r.resume_check) === 'decision');
      if (paraVerificar.length) {
        console.log(`\n⏰ ${paraVerificar.length} LISTA(S) PARA VERIFICAR — trabajo casi terminado, se cierran rápido:`);
        for (const r of paraVerificar) {
          console.log(`   ${r.id}  ${String(r.title).slice(0, 60)}`);
          console.log(`      ▶ falta: ${String(r.resume_check).slice(0, 160)}`);
        }
        console.log('   (cógelas con `claim <id>`: imprime dónde se dejaron)');
      }
      if (paraManuel.length) {
        console.log(`\n🙋 ${paraManuel.length} ESPERANDO UNA DECISIÓN DE MANUEL — enséñaselas, no se pueden cerrar solas:`);
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
        console.log(`  ${EMOJI[r.priority]} ${r.id}  ${String(r.title).slice(0, 58).padEnd(60)} ${r.status.padEnd(12)} ${lock}${dep}`);
        if (dormida(r) && r.snooze_reason) console.log(`         ↳ ${r.snooze_reason}`);
        if (enEsperaAlguna(r) && r.resume_check) console.log(`         ▶ al despertar: ${r.resume_check}`);
        if (isChronicSnooze(r)) console.log(`         🔁 aplazada ${r.snooze_count} veces`);
      }
      if (enEspera) console.log(`\n  🕒 ${enEspera} en espera (no las sugiere \`next\`; se despiertan solas)`);

      console.log('');
    }

    else if (cmd === 'next') {
      const rows = await s`
        SELECT id, title, priority, status, claimed_by, lease_until, blocked_by, snooze_until, snooze_reason,
               wake_on_deploy_sha
          FROM public.backlog_tasks WHERE status IN ('open','in_progress','blocked')`;
      const openIds = new Set(rows.map((r) => r.id));
      const rank = { critica: 0, alta: 1, media: 2, baja: 3, ninguna: 9 };
      const dormidas = rows.filter(enEsperaAlguna).length;
      const libre = rows
        .filter((r) => !r.claimed_by || r.claimed_by === sid || (r.lease_until && new Date(r.lease_until) < new Date()))
        .filter((r) => r.priority !== 'ninguna') // aparcadas: no se sugieren nunca
        .filter((r) => !enEsperaAlguna(r))       // aplazadas o esperando deploy: hoy no hay nada que hacer
        .filter((r) => !(r.blocked_by || []).some((d) => openIds.has(d)))
        .sort((a, b) => (rank[a.priority] - rank[b.priority]) || a.id.localeCompare(b.id));
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
      const [row] = await s`
        UPDATE public.backlog_tasks t
           SET claimed_by = ${sid}, claimed_at = now(),
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
              -- dependencia: bloqueada por otra tarea NUESTRA aún viva (salvo --force)
              AND (${force} OR NOT EXISTS (
                    SELECT 1 FROM public.backlog_tasks d
                     WHERE d.id = ANY(COALESCE(backlog_tasks.blocked_by, '{}'))
                       AND d.status IN ('open','in_progress','blocked')))
            FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING id, title, priority, blocked_by, snooze_until, snooze_reason, snooze_count`;
      if (!row) {
        const [cur] = await s`
          SELECT id, title, status, claimed_by, lease_until, snooze_until, snooze_reason, blocked_by,
                 wake_on_deploy_sha, wake_on_deploy_surface
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
      console.log(`   lease ${LEASE_MIN} min · renueva con: node scripts/backlog.cjs heartbeat`);
      // Reclamar = LEER: escupimos la ficha entera del markdown. Así no existe "abrir la
      // tarea" separado de "reclamarla" → se elimina la ventana de olvido (el pre-push
      // bloquea de todos modos, pero esto lo hace innecesario en el flujo normal).
      const ficha = fichaBody(row.id);
      if (ficha) console.log(`\n${'─'.repeat(60)}\n${ficha}\n${'─'.repeat(60)}`);
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
        console.error(`❌ NO cerrada: el outcome ${pend.motivo}, así que la tarea NO está terminada.`);
        console.error('   Si queda trabajo, prográmale la vuelta en vez de cerrarla en falso:');
        console.error(`     node scripts/backlog.cjs pause ${id} --tras-deploy --superficie frontend|backend|both \\`);
        console.error('       --hecho "…lo que ya está…" --falta "…lo que queda…"');
        console.error(`     node scripts/backlog.cjs pause ${id} --hasta "2026-08-11 07:00" --hecho "…" --falta "…"`);
        console.error('   Si de verdad está terminada y el texto engaña:  --igualmente');
        process.exit(2);
      }
      const [row] = await s`
        UPDATE public.backlog_tasks
           SET status = 'done', outcome = ${outcome}, closed_at = now(),
               claimed_by = NULL, claimed_at = NULL, lease_until = NULL
         WHERE id = ${id} AND (claimed_by = ${sid} OR claimed_by IS NULL)
        RETURNING id, title`;
      if (!row) { console.error(`❌ no pude cerrar ${id} (¿la tiene otra sesión?)`); process.exit(1); }
      console.log(`✅ ${row.id} cerrada.`);
      console.log(`   ⚠️ AHORA mueve su entrada a "## Hechas" en docs/roadmap/tareas-pendientes.md`);
      console.log(`      (el guardarraíl de CI falla si sigue en "Abiertas")`);
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
           SET claimed_by = NULL, claimed_at = NULL, lease_until = NULL,
               status = CASE WHEN status = 'in_progress' THEN 'open' ELSE status END
         WHERE id = ${id} AND claimed_by = ${sid} RETURNING id`;
      console.log(row ? `✅ ${row.id} liberada.` : '❌ no era tuya (o no existe).');
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
      const vivas = await s`SELECT id FROM public.backlog_tasks WHERE status IN ('open','in_progress','blocked')`;
      const idsEnMd = new Set(md.map((t) => t.id));
      const sinFicha = vivas.map((r) => r.id).filter((id) => !idsEnMd.has(id));
      if (sinFicha.length) {
        const { clasificarHuerfanas } = require(path.join(REPO, 'lib', 'backlog', 'fichaHuerfana.cjs'));
        const { borradas, sinPushear } = clasificarHuerfanas(
          sinFicha.map((id) => ({ id, estuvoEnElMarkdown: estuvoEnElHistorial(id) })));
        if (borradas.length) {
          console.error(`🔴 FICHA BORRADA del markdown y la tarea sigue VIVA: ${borradas.join(', ')}`);
          console.error('   Alguien commiteó el fichero rancio y se llevó la ficha por delante.');
          for (const id of borradas) {
            console.error(`   recupérala:  git log -S'### [${id}]' -- ${MD_REL}`);
          }
        }
        if (sinPushear.length) {
          console.log(`ℹ️ sin ficha aquí todavía (otra sesión sin pushear): ${sinPushear.join(', ')}`);
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
      const idsMd = md.filter((t) => t.inOpenSection && !t.doneMarked).map((t) => t.id);
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
            estuvoEnElHistorial: estuvoEnElHistorial(t.id),
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
        const cerrada = !t.inOpenSection || t.doneMarked;
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
      const [row] = await s`
        UPDATE public.backlog_tasks SET snooze_until = NULL, snooze_reason = NULL, snoozed_by = NULL
         WHERE id = ${id} RETURNING id, title`;
      if (!row) { console.error(`❌ ${id} no existe`); process.exit(1); }
      console.log(`⏰ ${row.id} despierta — ${row.title}`);
    }

    else if (cmd === 'reserve') {
      const titulo = process.argv[3] || 'RESERVADA — ficha pendiente de escribir en el markdown';
      // Se reintenta por si otra sesión gana la carrera entre el SELECT y el INSERT:
      // la unicidad la garantiza la PK, no este cálculo.
      let reservado = null;
      for (let intento = 0; intento < 10 && !reservado; intento++) {
        const filas = await s`SELECT id FROM public.backlog_tasks`;
        const nums = filas
          .map((r) => parseInt(String(r.id).replace(/\D/g, ''), 10))
          .filter((n) => Number.isFinite(n));
        const siguiente = `T-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
        const [r] = await s`
          INSERT INTO public.backlog_tasks (id, title, priority, status)
          VALUES (${siguiente}, ${titulo}, 'media', 'open')
          ON CONFLICT (id) DO NOTHING RETURNING id`;
        if (r) reservado = r.id;
      }
      if (!reservado) { console.error('❌ no se pudo reservar un id tras 10 intentos'); process.exit(2); }
      console.log(`✅ id reservado: ${reservado}`);
      console.log(`   escribe la ficha en docs/roadmap/tareas-pendientes.md como:  ### [${reservado}] 🟡 [ABIERTO …] <título>`);
      console.log(`   y luego:  node scripts/backlog.cjs sync   (actualizará el título real)`);
    }

    else {
      console.log('Uso: backlog.cjs list [--all] | next | claim <id> | heartbeat | mine | done <id> --outcome "…" | reopen <id> --motivo "…" | release <id> | snooze <id> --hasta|--horas|--dias --motivo "…" | pause <id> (--hasta …|--tras-deploy [sha] [--superficie frontend|backend|both]) --hecho "…" --falta "…" | deployed <sha> --superficie … | wake <id> | reserve ["título"] | sync');
    }
  } catch (e) {
    console.error('❌', e.message);
    process.exitCode = 1;
  } finally {
    await s.end();
  }
})();
