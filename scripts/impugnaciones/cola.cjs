#!/usr/bin/env node
// Gestor de cola con CLAIM para que 2-10 sesiones de Claude Code repartan las colas
// (impugnaciones + feedback) SIN pisarse. Lee/escribe SIEMPRE en RDS (pg/DATABASE_URL),
// nunca @supabase/supabase-js (que apunta al Supabase congelado).
//
// El claim es atómico vía FOR UPDATE SKIP LOCKED: dos sesiones NUNCA reciben la misma fila.
// Un claim se considera libre si claimed_by IS NULL, es tuyo, o es viejo (> STALE_HOURS).
// El cierre (status -> resolved/rejected/dismissed) lo saca del pool solo.
//
// Uso:
//   node scripts/impugnaciones/cola.cjs list                      # ver las 3 colas + estado de claim
//   node scripts/impugnaciones/cola.cjs next  --sid <ID> [--queue disputes|feedback]
//   node scripts/impugnaciones/cola.cjs mine  --sid <ID>
//   node scripts/impugnaciones/cola.cjs release <id> --sid <ID>
//
// <ID> = tu id de sesión. Usa el UUID de tu carpeta de scratchpad (único por sesión).
const fs = require('fs');
const pg = require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres');
const STALE_HOURS = 2;

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(require('path').join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }
// El session-id se pasa con --sid o, si no, se lee de .session-id (lo escribe new-session.sh)
// en el cwd o en la raíz del repo. Así cada sesión usa el suyo sin pasarlo a mano.
function readSessionId() {
  const path = require('path');
  for (const p of [path.join(process.cwd(), '.session-id'), path.join(__dirname, '..', '..', '.session-id')]) {
    try { const v = fs.readFileSync(p, 'utf8').trim(); if (v) return v; } catch {}
  }
  return null;
}

const cmd = process.argv[2];
const sid = arg('--sid') || readSessionId();
const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
const stale = `${STALE_HOURS} hours`;

// Tablas de cada cola: [tabla, estados-abiertos, herramienta/flujo a usar]
const DISPUTE_TBL = [
  { tbl: 'question_disputes', open: ['pending', 'appealed'], kind: 'legislative' },
  { tbl: 'psychometric_question_disputes', open: ['pending', 'appealed'], kind: 'psychometric' },
];
const FEEDBACK_TBL = [{ tbl: 'user_feedback', open: ['pending'], kind: 'feedback' }];

const age = (t) => {
  if (!t) return '';
  const mins = Math.round((Date.now() - new Date(t).getTime()) / 60000);
  return mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`;
};

async function claimFrom(list) {
  // Recorre las tablas en orden y coge la fila abierta más antigua que esté libre.
  // Luego coge TAMBIÉN todas las demás pendientes DEL MISMO USUARIO en esa tabla: una
  // sesión lleva a un usuario entero (más contexto, y no lo trocea entre sesiones).
  // Detalle: manual impugnaciones §7.5 (clustering mismo-usuario). Sigue respondiéndose UNA POR UNA.
  for (const { tbl, open, kind } of list) {
    const typeCol = tbl === 'user_feedback' ? 'type' : 'dispute_type';
    const [row] = await s.unsafe(
      `UPDATE public.${tbl}
         SET claimed_by = $1, claimed_at = now()
       WHERE id = (
         SELECT id FROM public.${tbl}
          WHERE status = ANY($2)
            AND (claimed_by IS NULL OR claimed_by = $1 OR claimed_at < now() - interval '${stale}')
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1)
       RETURNING id, user_id, ${typeCol} AS dispute_type, created_at`,
      [sid, open]
    );
    if (!row) continue;
    // Cluster del mismo usuario: coge sus otras pendientes libres (SKIP LOCKED = no bloquea si otra sesión las tiene).
    let siblings = [];
    if (row.user_id != null) {
      siblings = await s.unsafe(
        `UPDATE public.${tbl}
           SET claimed_by = $1, claimed_at = now()
         WHERE id IN (
           SELECT id FROM public.${tbl}
            WHERE user_id = $3 AND id <> $4 AND status = ANY($2)
              AND (claimed_by IS NULL OR claimed_by = $1 OR claimed_at < now() - interval '${stale}')
            FOR UPDATE SKIP LOCKED)
         RETURNING id, ${typeCol} AS dispute_type, created_at`,
        [sid, open, row.user_id, row.id]
      );
    }
    return { ...row, kind, tbl, siblings };
  }
  return null;
}

async function listQueue(list) {
  const out = [];
  for (const { tbl, open, kind } of list) {
    const rows = await s.unsafe(
      `SELECT id, ${tbl === 'user_feedback' ? 'type' : 'dispute_type'} AS t, status, created_at, claimed_by, claimed_at
         FROM public.${tbl} WHERE status = ANY($1) ORDER BY created_at`, [open]);
    rows.forEach((r) => out.push({ ...r, kind }));
  }
  return out;
}

(async () => {
  try {
    if (cmd === 'list') {
      const rows = [...(await listQueue(DISPUTE_TBL)), ...(await listQueue(FEEDBACK_TBL))];
      if (!rows.length) { console.log('Cola vacía (0 pendientes en RDS).'); return; }
      console.log(`COLA (RDS) — ${rows.length} pendientes:\n`);
      for (const r of rows) {
        const fresh = r.claimed_by && (Date.now() - new Date(r.claimed_at).getTime()) < STALE_HOURS * 3600e3;
        const lock = fresh ? `🔒 ${r.claimed_by.slice(0, 8)} (hace ${age(r.claimed_at)})` : (r.claimed_by ? '🟡 claim viejo (libre)' : '🟢 libre');
        console.log(`  [${r.kind}] ${r.id} | ${r.t} | ${r.status} | hace ${age(r.created_at)} | ${lock}`);
      }
      return;
    }

    if (cmd === 'next') {
      if (!sid) { console.error('Falta --sid <tu-id-de-sesión>'); process.exit(2); }
      const queue = arg('--queue') || 'disputes';
      const list = queue === 'feedback' ? FEEDBACK_TBL : DISPUTE_TBL;
      const row = await claimFrom(list);
      if (!row) { console.log(`Sin items libres en la cola "${queue}" (todo cogido o vacío).`); return; }
      const sibs = row.siblings || [];
      console.log(`✅ CLAIM hecho por ${sid.slice(0, 8)} (usuario ${String(row.user_id).slice(0, 8)}):`);
      console.log(`   id:   ${row.id}`);
      console.log(`   tipo: [${row.kind}] ${row.dispute_type} | creada hace ${age(row.created_at)}`);
      if (sibs.length) {
        console.log(`   + ${sibs.length} MÁS del mismo usuario cogidas (llévalas TÚ, más contexto — pero responde UNA POR UNA):`);
        sibs.forEach((x) => console.log(`      · ${x.id} | ${x.dispute_type} | hace ${age(x.created_at)}`));
      }
      if (row.kind === 'feedback') console.log(`   → siguiente: flujo docs/procedures/gestionar-feedback-bug.md`);
      else console.log(`   → siguiente: node scripts/impugnaciones/revisar-impugnacion.cjs ${row.id}`);
      return;
    }

    if (cmd === 'mine') {
      if (!sid) { console.error('Falta --sid'); process.exit(2); }
      const all = [...DISPUTE_TBL, ...FEEDBACK_TBL];
      let any = false;
      for (const { tbl, open, kind } of all) {
        const rows = await s.unsafe(
          `SELECT id, status, claimed_at FROM public.${tbl}
            WHERE claimed_by = $1 AND status = ANY($2) ORDER BY claimed_at`, [sid, open]);
        rows.forEach((r) => { any = true; console.log(`  [${kind}] ${r.id} | ${r.status} | cogida hace ${age(r.claimed_at)}`); });
      }
      if (!any) console.log('No tienes claims activos.');
      return;
    }

    if (cmd === 'release') {
      const id = process.argv[3];
      if (!id || !sid) { console.error('Uso: cola.cjs release <id> --sid <ID>'); process.exit(2); }
      let done = false;
      for (const { tbl } of [...DISPUTE_TBL, ...FEEDBACK_TBL]) {
        const res = await s.unsafe(
          `UPDATE public.${tbl} SET claimed_by = NULL, claimed_at = NULL WHERE id = $1 AND claimed_by = $2 RETURNING id`, [id, sid]);
        if (res.length) { done = true; console.log(`✅ Liberada ${id} de ${tbl}.`); }
      }
      if (!done) console.log('No se liberó nada (¿id no existe o no es tuyo?).');
      return;
    }

    if (cmd === 'release-all') {
      if (!sid) { console.error('Falta --sid (o .session-id)'); process.exit(2); }
      let n = 0;
      for (const { tbl } of [...DISPUTE_TBL, ...FEEDBACK_TBL]) {
        const res = await s.unsafe(
          `UPDATE public.${tbl} SET claimed_by = NULL, claimed_at = NULL WHERE claimed_by = $1 RETURNING id`, [sid]);
        n += res.length;
      }
      console.log(`✅ Liberados ${n} claims del sid ${sid.slice(0, 12)}.`);
      return;
    }

    console.error('Comandos: list | next --sid <ID> [--queue disputes|feedback] | mine --sid <ID> | release <id> --sid <ID> | release-all --sid <ID>');
    process.exit(2);
  } finally { await s.end(); }
})();
