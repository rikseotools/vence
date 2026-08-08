require('dotenv').config({ path: '.env.local' });
const { pgConfig } = require('/home/manuel/Documentos/github/vence/lib/db/pgSsl.cjs');
const { Client } = require('pg');
const { estadoReserva } = require('/home/manuel/Documentos/github/vence/lib/impugnaciones/reserva.cjs');
(async () => {
  const c = new Client(pgConfig());
  await c.connect();
  const ses = (await c.query(`SELECT sid, slug, last_signal_at FROM worktree_sessions`)).rows;
  const d = (await c.query(`SELECT id, claimed_by, claimed_at FROM question_disputes WHERE status IN ('pending','appealed')`)).rows;
  for (const r of d) {
    const e = estadoReserva({ claimedBy: r.claimed_by, claimedAt: r.claimed_at, sesiones: ses, sid: '77bfc0ac-1c0e-413e-a576-16c625db0caf' });
    console.log(r.id.slice(0,8), '| dueño:', r.claimed_by || '—', '|', e.libre ? '🟢 LIBRE' : '🔒 OCUPADA', '|', e.motivo);
  }
  console.log('\n¿47215d1b publica latido?', ses.some(x => x.sid && x.sid.startsWith('47215d1b')) ? 'SÍ' : 'NO (sid no está en worktree_sessions)');
  await c.end();
})();
