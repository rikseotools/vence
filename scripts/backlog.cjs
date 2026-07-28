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

const LEASE_MIN = 90;                 // duración del lease; heartbeat lo renueva
const REPO = path.join(__dirname, '..');
const MD = path.join(REPO, 'docs', 'roadmap', 'tareas-pendientes.md');

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }
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

(async () => {
  try {
    if (cmd === 'list') {
      const all = process.argv.includes('--all');
      const rows = await s`
        SELECT id, title, priority, status, claimed_by, claimed_at, lease_until, blocked_by,
               snooze_until, snooze_reason
          FROM public.backlog_tasks
         ${all ? s`` : s`WHERE status IN ('open','in_progress','blocked')`}
         ORDER BY CASE priority WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 WHEN 'baja' THEN 3 ELSE 9 END, id`;
      console.log(`\nBACKLOG — ${rows.length} tarea(s)${all ? ' (todas)' : ' abiertas'}:\n`);
      let enEspera = 0;
      for (const r of rows) {
        const vivo = r.lease_until && new Date(r.lease_until) > new Date();
        // El aplazamiento se pinta ANTES que "libre": libre-pero-dormida se leía como
        // "cógela", que es justo el malentendido que esto viene a quitar.
        const lock = dormida(r) ? (enEspera++, `🕒 en espera hasta ${cuando(r.snooze_until)}`)
          : !r.claimed_by ? '🟢 libre'
          : vivo ? `🔒 ${String(r.claimed_by).slice(0, 8)} (${left(r.lease_until)})`
                 : `🟡 lease caducado hace ${age(r.lease_until)} (libre)`;
        const dep = (r.blocked_by || []).length ? ` ⛔ bloqueada por ${r.blocked_by.join(',')}` : '';
        console.log(`  ${EMOJI[r.priority]} ${r.id}  ${String(r.title).slice(0, 58).padEnd(60)} ${r.status.padEnd(12)} ${lock}${dep}`);
        if (dormida(r) && r.snooze_reason) console.log(`         ↳ ${r.snooze_reason}`);
      }
      if (enEspera) console.log(`\n  🕒 ${enEspera} en espera (no las sugiere \`next\`; se despiertan solas)`);
      console.log('');
    }

    else if (cmd === 'next') {
      const rows = await s`
        SELECT id, title, priority, status, claimed_by, lease_until, blocked_by, snooze_until, snooze_reason
          FROM public.backlog_tasks WHERE status IN ('open','in_progress','blocked')`;
      const openIds = new Set(rows.map((r) => r.id));
      const rank = { critica: 0, alta: 1, media: 2, baja: 3, ninguna: 9 };
      const dormidas = rows.filter(dormida).length;
      const libre = rows
        .filter((r) => !r.claimed_by || r.claimed_by === sid || (r.lease_until && new Date(r.lease_until) < new Date()))
        .filter((r) => r.priority !== 'ninguna') // aparcadas: no se sugieren nunca
        .filter((r) => !dormida(r))              // aplazadas: hoy no hay nada que hacer en ellas
        .filter((r) => !(r.blocked_by || []).some((d) => openIds.has(d)))
        .sort((a, b) => (rank[a.priority] - rank[b.priority]) || a.id.localeCompare(b.id));
      if (dormidas) console.log(`(${dormidas} en espera por reloj — se saltan; \`list\` las muestra con su hora)`);
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
      // Atómico: SKIP LOCKED + la condición de lease. Dos sesiones NUNCA cogen la misma.
      const [row] = await s`
        UPDATE public.backlog_tasks
           SET claimed_by = ${sid}, claimed_at = now(),
               lease_until = now() + (${LEASE_MIN} || ' minutes')::interval,
               status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END
         WHERE id = (
           SELECT id FROM public.backlog_tasks
            WHERE id = ${id}
              AND status IN ('open','in_progress','blocked')
              AND (claimed_by IS NULL OR claimed_by = ${sid} OR lease_until < now())
            FOR UPDATE SKIP LOCKED LIMIT 1)
        RETURNING id, title, priority, blocked_by, snooze_until, snooze_reason`;
      if (!row) {
        const [cur] = await s`SELECT status, claimed_by, lease_until FROM public.backlog_tasks WHERE id = ${id}`;
        if (!cur) console.error(`❌ ${id} no existe (¿has corrido 'sync'?)`);
        else if (['done', 'dropped'].includes(cur.status)) console.error(`❌ ${id} ya está cerrada (${cur.status})`);
        else console.error(`❌ ${id} la tiene ${String(cur.claimed_by).slice(0, 12)} (lease hasta ${cur.lease_until})`);
        process.exit(1);
      }
      console.log(`✅ CLAIM ${row.id} — ${row.title}`);
      // AVISA, no impide: aplazar es "hoy no hay nada que medir", y aun así puede ser
      // legítimo adelantar la preparación. Lo que no puede pasar es cogerla sin saberlo.
      if (dormida(row)) {
        console.log(`   🕒 OJO: está EN ESPERA hasta ${cuando(row.snooze_until)}${row.snooze_reason ? ` — ${row.snooze_reason}` : ''}`);
        console.log('      (si vas a trabajarla igualmente, despiértala: node scripts/backlog.cjs wake ' + row.id + ')');
      }
      if ((row.blocked_by || []).length) console.log(`   ⚠️ declarada bloqueada por: ${row.blocked_by.join(', ')}`);
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
        const { esOtraTarea } = require(path.join(REPO, 'lib', 'backlog', 'syncGuard.cjs'));
        const enBd = await s`
          SELECT id, title FROM public.backlog_tasks
           WHERE id IN ${s(idsMd)} AND status IN ('open','in_progress','blocked')`;
        const porId = new Map(enBd.map((r) => [r.id, r.title]));
        const ajenas = md
          .filter((t) => porId.has(t.id) && esOtraTarea(porId.get(t.id), t.title))
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
      // Solo las VIVAS pueden ser huérfanas de verdad: una tarea viva sin ficha no se puede
      // trabajar (nadie sabe qué es). Borrar la ficha de una CERRADA, en cambio, es limpieza
      // legítima y documentada, así que incluirlas aquí producía un aviso permanentemente
      // falso (T-033/T-039/T-046) que enseñaba a ignorar la salida del sync.
      const db = await s`SELECT id FROM public.backlog_tasks WHERE status IN ('open','in_progress','blocked')`;
      const mdIds = new Set(md.map((t) => t.id));
      const huerfanas = db.map((r) => r.id).filter((id) => !mdIds.has(id));
      if (huerfanas.length) console.log(`⚠️ VIVA en BD pero SIN ficha en el markdown: ${huerfanas.join(', ')}`);
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
           SET snooze_until = ${hasta}, snooze_reason = ${motivo}, snoozed_by = ${sid || 'cli'}
         WHERE id = ${id} AND status IN ('open','in_progress','blocked')
        RETURNING id, title`;
      if (!row) { console.error(`❌ ${id} no existe o está cerrada`); process.exit(1); }
      console.log(`🕒 ${row.id} EN ESPERA hasta ${cuando(hasta)} — ${row.title}`);
      console.log(`   motivo: ${motivo}`);
      console.log('   (no la sugiere `next`; se despierta sola, sin que nadie se acuerde)');
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
      console.log('Uso: backlog.cjs list [--all] | next | claim <id> | heartbeat | mine | done <id> --outcome "…" | release <id> | snooze <id> --hasta|--horas|--dias --motivo "…" | wake <id> | reserve ["título"] | sync');
    }
  } catch (e) {
    console.error('❌', e.message);
    process.exitCode = 1;
  } finally {
    await s.end();
  }
})();
