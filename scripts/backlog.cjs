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

const EMOJI = { critica: '🔴', alta: '🟠', media: '🟡', baja: '🟢' };
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
function needSid() {
  if (!sid) { console.error('❌ sin session-id: usa --sid <ID> o crea un fichero .session-id'); process.exit(2); }
}

// Parseo del markdown: mismo formato que lib/backlog/claim.ts (### [T-042] 🔴 Título)
function parseMd() {
  const md = fs.readFileSync(MD, 'utf8');
  const out = []; let inOpen = false;
  const E2P = { '🔴': 'critica', '🟠': 'alta', '🟡': 'media', '🟢': 'baja' };
  for (const line of md.split('\n')) {
    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) { inOpen = /abiertas/i.test(h2[1]); continue; }
    const h3 = /^###\s+(.*)$/.exec(line);
    if (!h3) continue;
    const idM = /\[(T-\d+)\]/.exec(h3[1]);
    if (!idM) continue;
    const emoji = Object.keys(E2P).find((e) => h3[1].includes(e));
    const title = h3[1].replace(/\[(T-\d+)\]/, '').replace(/[🔴🟠🟡🟢✅]/g, '')
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
        SELECT id, title, priority, status, claimed_by, claimed_at, lease_until, blocked_by
          FROM public.backlog_tasks
         ${all ? s`` : s`WHERE status IN ('open','in_progress','blocked')`}
         ORDER BY CASE priority WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, id`;
      console.log(`\nBACKLOG — ${rows.length} tarea(s)${all ? ' (todas)' : ' abiertas'}:\n`);
      for (const r of rows) {
        const vivo = r.lease_until && new Date(r.lease_until) > new Date();
        const lock = !r.claimed_by ? '🟢 libre'
          : vivo ? `🔒 ${String(r.claimed_by).slice(0, 8)} (${left(r.lease_until)})`
                 : `🟡 lease caducado hace ${age(r.lease_until)} (libre)`;
        const dep = (r.blocked_by || []).length ? ` ⛔ bloqueada por ${r.blocked_by.join(',')}` : '';
        console.log(`  ${EMOJI[r.priority]} ${r.id}  ${String(r.title).slice(0, 58).padEnd(60)} ${r.status.padEnd(12)} ${lock}${dep}`);
      }
      console.log('');
    }

    else if (cmd === 'next') {
      const rows = await s`
        SELECT id, title, priority, status, claimed_by, lease_until, blocked_by
          FROM public.backlog_tasks WHERE status IN ('open','in_progress','blocked')`;
      const openIds = new Set(rows.map((r) => r.id));
      const rank = { critica: 0, alta: 1, media: 2, baja: 3 };
      const libre = rows
        .filter((r) => !r.claimed_by || r.claimed_by === sid || (r.lease_until && new Date(r.lease_until) < new Date()))
        .filter((r) => !(r.blocked_by || []).some((d) => openIds.has(d)))
        .sort((a, b) => (rank[a.priority] - rank[b.priority]) || a.id.localeCompare(b.id));
      if (!libre.length) { console.log('No hay tareas libres (todas cogidas o bloqueadas).'); }
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
        RETURNING id, title, priority, blocked_by`;
      if (!row) {
        const [cur] = await s`SELECT status, claimed_by, lease_until FROM public.backlog_tasks WHERE id = ${id}`;
        if (!cur) console.error(`❌ ${id} no existe (¿has corrido 'sync'?)`);
        else if (['done', 'dropped'].includes(cur.status)) console.error(`❌ ${id} ya está cerrada (${cur.status})`);
        else console.error(`❌ ${id} la tiene ${String(cur.claimed_by).slice(0, 12)} (lease hasta ${cur.lease_until})`);
        process.exit(1);
      }
      console.log(`✅ CLAIM ${row.id} — ${row.title}`);
      if ((row.blocked_by || []).length) console.log(`   ⚠️ declarada bloqueada por: ${row.blocked_by.join(', ')}`);
      console.log(`   lease ${LEASE_MIN} min · renueva con: node scripts/backlog.cjs heartbeat`);
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
      // Importa del markdown los ids que aún no están en la tabla. NO toca los existentes
      // (el estado vive en BD; el markdown solo aporta id/título/prioridad).
      const md = parseMd();
      let nuevos = 0;
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
        if (r) nuevos++;
      }
      console.log(`sync: ${md.length} en markdown · ${nuevos} nueva(s) insertada(s).`);
      const db = await s`SELECT id FROM public.backlog_tasks`;
      const mdIds = new Set(md.map((t) => t.id));
      const huerfanas = db.map((r) => r.id).filter((id) => !mdIds.has(id));
      if (huerfanas.length) console.log(`⚠️ en BD pero NO en el markdown: ${huerfanas.join(', ')}`);
    }

    else {
      console.log('Uso: backlog.cjs list [--all] | next | claim <id> | heartbeat | mine | done <id> --outcome "…" | release <id> | sync');
    }
  } catch (e) {
    console.error('❌', e.message);
    process.exitCode = 1;
  } finally {
    await s.end();
  }
})();
