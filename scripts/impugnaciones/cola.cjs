#!/usr/bin/env node
// Gestor de cola con CLAIM para que 2-10 sesiones de Claude Code repartan las colas
// (impugnaciones + feedback) SIN pisarse. Lee/escribe SIEMPRE en RDS (pg/DATABASE_URL),
// nunca @supabase/supabase-js (que apunta al Supabase congelado).
//
// El claim es atómico vía FOR UPDATE SKIP LOCKED: dos sesiones NUNCA reciben la misma fila.
// Cuándo una reserva vuelve a estar libre lo decide UN solo sitio — `lib/impugnaciones/reserva.cjs`
// (señal de vida de la sesión dueña, con suelo por reloj) — y de ahí sale tanto el claim como lo
// que pinta `list`: tener dos criterios para el mismo recurso no protege, se contradice (T-474).
// El cierre (status -> resolved/rejected/dismissed) lo saca del pool solo, y desde T-474 exige
// tener la fila reservada (`lib/impugnaciones/puertaCierre.cjs`, en cerrar.ts / cerrar-feedback.ts).
//
// Uso:
//   node scripts/impugnaciones/cola.cjs list                      # ver las 3 colas + estado de claim
//   node scripts/impugnaciones/cola.cjs next  --sid <ID> [--queue disputes|feedback]
//   node scripts/impugnaciones/cola.cjs mine  --sid <ID>
//   node scripts/impugnaciones/cola.cjs release <id> --sid <ID>
//   node scripts/impugnaciones/cola.cjs claim <id> --sid <ID>   # una CONCRETA (el resto las lleva otra sesión)
//
// <ID> = tu id de sesión. Usa el UUID de tu carpeta de scratchpad (único por sesión).
const fs = require('fs');
const pg = require('postgres');

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(require('path').join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }
// El session-id se resuelve solo (nada que teclear): --sid explícito > fichero .session-id
// (lo escribe crear-worktree.sh) > CLAUDE_CODE_SESSION_ID (cada sesión de Claude Code ya trae
// el suyo, único). Así el claim funciona sin configurar nada.
// Resuelto por el módulo COMPARTIDO (T-407). Antes esta cola reclamaba con el id del fichero y
// `revisar-impugnacion.cjs` comparaba contra el de la variable de entorno: el mismo trabajo con
// dos identidades, y un aviso de «otra sesión» contra uno mismo.
const { resolverSid } = require(require('path').join(__dirname, '..', '..', 'lib', 'sessions', 'sid.cjs'));

const cmd = process.argv[2];
const sid = resolverSid({ repo: require('path').join(__dirname, '..', '..') }).sid;
const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
// El criterio de «reserva libre» vive en UN solo sitio (T-412): ya no es solo el reloj, también
// mira si la sesión dueña sigue LATIENDO. Así una revisión larga pero viva conserva su reserva,
// y un ordenador apagado la suelta sola. Ver lib/impugnaciones/reserva.cjs.
const { sqlReservaLibre, etiquetaReserva } = require(require('path').join(__dirname, '..', '..', 'lib', 'impugnaciones', 'reserva.cjs'));
// Abreviar un sid es cosa de `sid.cjs` (T-538): a 8 caracteres, cinco sesiones del mismo día se
// escriben igual y el listado hacía pasar por propias las reservas ajenas.
const { sidCorto } = require(require('path').join(__dirname, '..', '..', 'lib', 'sessions', 'sid.cjs'));

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

/**
 * Cola de feedback: el ORDEN DE ATENCIÓN lo decide `lib/feedback/prioridadCola.js` (bug →
 * pre-venta → premium → baja), no la antigüedad.
 *
 * Por qué esto existe (30/07/2026): el orden lo fijó Manuel ese día y quedó aplicado solo en
 * `vigia.cjs`, que **muestra** la cola. Quien la **REPARTE** —esto— seguía ordenando por
 * `created_at`, así que la primera sesión que pedía trabajo se llevaba la eliminación de cuenta
 * de hace 44 h… que es precisamente la que va la ÚLTIMA. Dos verdades, y mandaba la equivocada:
 * la que decide en qué trabaja la gente. Medido en vivo el mismo día.
 *
 * Devuelve el id que toca, o null si no hay ninguno libre. No reclama: solo elige.
 */
async function elegirFeedbackPorPrioridad(open) {
  const { ordenarCola } = require(require('path').join(__dirname, '..', '..', 'lib', 'feedback', 'prioridadCola.js'));
  const libres = await s.unsafe(
    `SELECT f.id, f.type, f.message, f.created_at, u.plan_type AS plan
       FROM public.user_feedback f
       LEFT JOIN public.user_profiles u ON u.id = f.user_id
      WHERE f.status = ANY($2)
        AND ${sqlReservaLibre('f.', '$1')}`,
    [sid, open]
  );
  if (!libres.length) return null;
  return ordenarCola(libres)[0].id;
}

async function claimFrom(list) {
  // Recorre las tablas en orden y coge la fila abierta más antigua que esté libre.
  // Luego coge TAMBIÉN todas las demás pendientes DEL MISMO USUARIO en esa tabla: una
  // sesión lleva a un usuario entero (más contexto, y no lo trocea entre sesiones).
  // Detalle: manual impugnaciones §7.5 (clustering mismo-usuario). Sigue respondiéndose UNA POR UNA.
  for (const { tbl, open, kind } of list) {
    const typeCol = tbl === 'user_feedback' ? 'type' : 'dispute_type';
    // El feedback se reparte por PRIORIDAD (ver arriba); las impugnaciones, por antigüedad.
    // El id elegido entra en el mismo UPDATE atómico con el mismo guard, así que dos sesiones
    // que elijan a la vez el mismo siguen sin poder llevárselo las dos (FOR UPDATE SKIP LOCKED).
    const elegido = tbl === 'user_feedback' ? await elegirFeedbackPorPrioridad(open) : null;
    if (tbl === 'user_feedback' && !elegido) continue;
    const [row] = await s.unsafe(
      `UPDATE public.${tbl}
         SET claimed_by = $1, claimed_at = now()
       WHERE id = (
         SELECT id FROM public.${tbl}
          WHERE status = ANY($2)
            AND ${sqlReservaLibre('', '$1')}
            ${elegido ? 'AND id = $3' : ''}
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1)
       RETURNING id, user_id, ${typeCol} AS dispute_type, created_at`,
      elegido ? [sid, open, elegido] : [sid, open]
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
              AND ${sqlReservaLibre('', '$1')}
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

/**
 * Filas que dicen `pending` pero YA están contestadas **y no son una alegación**.
 *
 * Nació el 28/07 al ver una impugnación cerrada reaparecer en la cola, y la primera versión estaba
 * MAL: marcaba como anomalía las ALEGACIONES, que son justo lo contrario —un usuario ejerciendo su
 * derecho a responder—. La causa real era otra y más gorda: el estado `appealed` no existía en la
 * BD (CHECK sin ese valor, 0 filas en 1.887), así que el camino que sí funcionaba escribía
 * `pending` y la alegación volvía a la cola disfrazada de impugnación nueva. Arreglado en
 * `supabase/migrations/20260728_dispute_status_appealed.sql`.
 *
 * Lo que queda vigilado aquí es el caso que NO tiene explicación: contestada, sin alegación, y de
 * vuelta en `pending`. Si aparece, alguien la movió por fuera y re-trabajarla le manda al usuario
 * un segundo correo con lo mismo.
 *
 * Se avisa, no se corrige sola: reparar en automático taparía la causa (y la primera versión de
 * este mismo guardarraíl demuestra por qué — habría "arreglado" alegaciones legítimas).
 */
async function inconsistentesResueltasEnPending() {
  const out = [];
  for (const { tbl, kind } of DISPUTE_TBL) {
    // Las psicotécnicas no tienen alegación (la tabla ni siquiera lleva `appeal_submitted_at`), así
    // que la exclusión se aplica solo donde la columna existe. Se consulta el esquema en vez de
    // asumirlo: dar por hecho que dos tablas hermanas tienen las mismas columnas es justo el tipo
    // de suposición que ha costado esta sesión entera.
    const [{ tiene }] = await s.unsafe(
      `SELECT count(*)::int > 0 AS tiene FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name='appeal_submitted_at'`, [tbl]);
    const rows = await s.unsafe(
      `SELECT id FROM public.${tbl}
        WHERE status = 'pending' AND (resolved_at IS NOT NULL OR admin_response IS NOT NULL)
          ${tiene ? 'AND appeal_submitted_at IS NULL' : ''}`);
    rows.forEach((r) => out.push({ ...r, kind }));
  }
  return out;
}

(async () => {
  try {
    if (cmd === 'list') {
      const rows = [...(await listQueue(DISPUTE_TBL)), ...(await listQueue(FEEDBACK_TBL))];
      const zombis = await inconsistentesResueltasEnPending();
      if (zombis.length) {
        console.log(`\n⚠️  ${zombis.length} impugnación(es) figuran PENDING pero ya tienen respuesta y fecha de resolución.`);
        console.log('   Contestadas, SIN alegación y de vuelta en pending: alguien las movió por fuera. NO las');
        console.log('   re-trabajes sin mirar: el usuario ya recibió respuesta y cerrarlas de nuevo le manda otro correo.');
        zombis.forEach((z) => console.log(`     · [${z.kind}] ${z.id}`));
      }
      if (!rows.length) { console.log('Cola vacía (0 pendientes en RDS).'); return; }
      // El estado de cada reserva se pinta con el MISMO núcleo que la concede (T-474). Antes aquí
      // había un reloj propio de 2 h: una fila reservada por una sesión que seguía trabajando salía
      // como «claim viejo (libre)» y la siguiente sesión se ponía con ella.
      const sesiones = await s`SELECT sid, last_signal_at FROM public.worktree_sessions`;
      console.log(`COLA (RDS) — ${rows.length} pendientes:\n`);
      for (const r of rows) {
        const lock = etiquetaReserva({ claimedBy: r.claimed_by, claimedAt: r.claimed_at, sesiones, sid });
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
      console.log(`✅ CLAIM hecho por ${sidCorto(sid)} (usuario ${String(row.user_id).slice(0, 8)}):`);
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

    // Coger UNA CONCRETA. Existe para el caso real de tener varias sesiones a la vez: cuando
    // otra sesión ya lleva parte de la cola, `next` te daría la que toca por prioridad —que
    // puede ser justo la suya— y hay que poder decir «esa no, esta». Mismo UPDATE atómico y
    // mismo guard que `next`, así que sigue siendo imposible que dos sesiones se lleven la
    // misma fila; y arrastra igualmente las hermanas del mismo usuario (una sesión = un usuario).
    if (cmd === 'claim') {
      const id = process.argv[3];
      if (!id || !sid) { console.error('Uso: cola.cjs claim <id> --sid <ID>'); process.exit(2); }
      for (const { tbl, open, kind } of [...DISPUTE_TBL, ...FEEDBACK_TBL]) {
        const typeCol = tbl === 'user_feedback' ? 'type' : 'dispute_type';
        const [row] = await s.unsafe(
          `UPDATE public.${tbl}
             SET claimed_by = $1, claimed_at = now()
           WHERE id = (
             SELECT id FROM public.${tbl}
              WHERE id = $3 AND status = ANY($2)
                AND ${sqlReservaLibre('', '$1')}
              FOR UPDATE SKIP LOCKED)
           RETURNING id, user_id, ${typeCol} AS dispute_type, created_at`,
          [sid, open, id]
        );
        if (!row) continue;
        console.log(`✅ CLAIM hecho por ${sidCorto(sid)} (usuario ${String(row.user_id ?? '?').slice(0, 8)}):`);
        console.log(`   id:   ${row.id}`);
        console.log(`   tipo: [${kind}] ${row.dispute_type} | creada hace ${age(row.created_at)}`);
        if (row.user_id != null) {
          const hermanas = await s.unsafe(
            `UPDATE public.${tbl} SET claimed_by = $1, claimed_at = now()
             WHERE id IN (
               SELECT id FROM public.${tbl}
                WHERE user_id = $3 AND id <> $4 AND status = ANY($2)
                  AND ${sqlReservaLibre('', '$1')}
                FOR UPDATE SKIP LOCKED)
             RETURNING id, ${typeCol} AS dispute_type`,
            [sid, open, row.user_id, row.id]
          );
          hermanas.forEach((h) => console.log(`   + del mismo usuario: ${h.id} (${h.dispute_type})`));
        }
        return;
      }
      console.log('No se pudo coger (¿id inexistente, ya cerrada, o la tiene otra sesión?).');
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
      console.log(`✅ Liberados ${n} claims del sid ${sidCorto(sid)}.`);
      return;
    }

    console.error('Comandos: list | next --sid <ID> [--queue disputes|feedback] | claim <id> --sid <ID> | mine --sid <ID> | release <id> --sid <ID> | release-all --sid <ID>');
    process.exit(2);
  } finally { await s.end(); }
})();
