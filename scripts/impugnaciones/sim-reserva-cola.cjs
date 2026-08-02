#!/usr/bin/env node
/**
 * sim-reserva-cola.cjs — comprueba, contra la BD de verdad, que la reserva de la cola hace lo que
 * dice. `npm run sim:cola-reserva`. (T-474)
 *
 * ## Por qué una simulación y no solo tests
 *
 * Los tests fijan el CRITERIO; esto comprueba las dos cosas que un test unitario no puede ver:
 *
 *   1. **Que el panel y la puerta dicen lo mismo sobre datos reales.** El defecto que motivó todo
 *      era exactamente ese desacuerdo: `cola.cjs list` pintaba con un reloj propio de 2 h mientras
 *      el claim decidía por señal de vida, así que una fila reservada por una sesión que seguía
 *      trabajando salía como «libre» y otra sesión se ponía con ella. Medido el 01/08/2026: 1 de
 *      5 casos divergía, y era ese.
 *   2. **Que el claim aguanta una carrera de verdad**, con N conexiones peleándose por la misma
 *      fila en el mismo instante — que es lo que `FOR UPDATE SKIP LOCKED` promete y lo único que
 *      no se puede afirmar sin Postgres delante.
 *
 * NO toca ni una fila viva: los casos se montan en una tabla propia (`sim_reserva_cola`) que se
 * crea y se borra aquí. Las sesiones de referencia (una viva, una muerta) salen de
 * `worktree_sessions` reales, porque inventarlas sería probar el mock y no el sistema.
 */
const fs = require('fs');
const path = require('path');
const pg = require('postgres');

const REPO = path.join(__dirname, '..', '..');
const { sqlReservaLibre, etiquetaReserva, estadoReserva, MIN_HORAS, LATIDO_VIVO_MIN } =
  require(path.join(REPO, 'lib', 'impugnaciones', 'reserva.cjs'));
const { puedeCerrar } = require(path.join(REPO, 'lib', 'impugnaciones', 'puertaCierre.cjs'));

const TABLA = 'sim_reserva_cola';
function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
// `onnotice` silenciado: el «table does not exist, skipping» del DROP IF EXISTS se imprimía como
// si fuera un error y ensuciaba justo la salida que hay que leer.
const conectar = () => pg(url(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30, onnotice: () => {} });

(async () => {
  const s = conectar();
  let fallos = 0;
  try {
    const [viva] = await s`SELECT sid FROM worktree_sessions WHERE last_signal_at > now() - interval '10 minutes' ORDER BY last_signal_at DESC LIMIT 1`;
    const [muerta] = await s`SELECT sid FROM worktree_sessions WHERE last_signal_at < now() - interval '10 hours' ORDER BY last_signal_at ASC LIMIT 1`;
    if (!viva || !muerta) {
      console.log('⚠️  no hay a la vez una sesión viva y una muerta en worktree_sessions — no se puede simular sin inventar datos.');
      process.exit(0);
    }
    const YO = 'sim-reserva-yo';
    console.log(`sesión VIVA de referencia:   ${viva.sid}`);
    console.log(`sesión MUERTA de referencia: ${muerta.sid}`);
    console.log(`umbrales: suelo ${MIN_HORAS} h · latido vivo ${LATIDO_VIVO_MIN} min\n`);

    await s.unsafe(`DROP TABLE IF EXISTS public.${TABLA}`);
    await s.unsafe(`CREATE TABLE public.${TABLA} (id text PRIMARY KEY, status text,
      created_at timestamptz DEFAULT now(), claimed_by text, claimed_at timestamptz)`);
    await s.unsafe(
      `INSERT INTO public.${TABLA} (id, status, claimed_by, claimed_at) VALUES
        ('A-libre',        'pending', NULL,  NULL),
        ('B-viva-3h',      'pending', $1,    now() - interval '3 hours'),
        ('C-muerta-3h',    'pending', $2,    now() - interval '3 hours'),
        ('D-sinlatido-3h', 'pending', 'sid-que-nunca-latio', now() - interval '3 hours'),
        ('E-viva-30m',     'pending', $1,    now() - interval '30 minutes'),
        ('F-mia',          'pending', $3,    now() - interval '4 hours')`,
      [viva.sid, muerta.sid, YO]);

    const sesiones = await s`SELECT sid, last_signal_at FROM worktree_sessions`;
    const filas = await s.unsafe(`SELECT id, claimed_by, claimed_at FROM public.${TABLA} ORDER BY id`);
    const cogibles = new Set((await s.unsafe(
      `SELECT id FROM public.${TABLA} WHERE ${sqlReservaLibre('', '$1')}`, [YO])).map((r) => r.id));

    console.log('┌── (1) ¿DICE LO MISMO EL PANEL QUE LA PUERTA? ─────────────────────────────────');
    for (const f of filas) {
      const puedeCogerla = cogibles.has(f.id);                 // lo que hace el claim (SQL)
      const etiqueta = etiquetaReserva({ claimedBy: f.claimed_by, claimedAt: f.claimed_at, sesiones, sid: YO });
      const pintaLibre = etiqueta.includes('🟢') || etiqueta.includes('🙋');
      const ok = pintaLibre === puedeCogerla;
      if (!ok) fallos++;
      console.log(`│ ${f.id.padEnd(16)} ${etiqueta.padEnd(58)} ${ok ? '✅' : '❌ EL PANEL MIENTE'}`);
    }
    console.log('└──────────────────────────────────────────────────────────────────────────────\n');

    console.log('┌── (2) LA PUERTA DE CIERRE, sobre las mismas filas ────────────────────────────');
    for (const f of filas) {
      const v = puedeCerrar({ claimedBy: f.claimed_by, claimedAt: f.claimed_at, sesiones, sid: YO });
      console.log(`│ ${f.id.padEnd(16)} ${v.permitido ? '✅ deja cerrar' : '⛔ bloquea'}  (${v.clase})`);
    }
    const soloMia = filas.filter((f) => puedeCerrar({ claimedBy: f.claimed_by, claimedAt: f.claimed_at, sesiones, sid: YO }).permitido);
    if (soloMia.length !== 1 || soloMia[0].id !== 'F-mia') {
      fallos++;
      console.log(`│ ❌ debería dejar cerrar SOLO la reservada por mí; deja ${soloMia.map((x) => x.id).join(', ') || 'ninguna'}`);
    } else {
      console.log('│ → solo se puede cerrar la que tengo reservada. Es el punto entero.');
    }
    console.log('└──────────────────────────────────────────────────────────────────────────────\n');

    console.log('┌── (3) CARRERA: 6 sesiones piden a la vez la misma fila ───────────────────────');
    await s.unsafe(`UPDATE public.${TABLA} SET claimed_by = NULL, claimed_at = NULL WHERE id = 'A-libre'`);
    await s.unsafe(`DELETE FROM public.${TABLA} WHERE id <> 'A-libre'`);
    const sids = Array.from({ length: 6 }, (_, i) => `sim-carrera-${i}`);
    const cs = sids.map(() => conectar());
    try {
      const res = await Promise.all(cs.map((c, i) => c.unsafe(
        `UPDATE public.${TABLA} SET claimed_by=$1, claimed_at=now()
          WHERE id = (SELECT id FROM public.${TABLA}
                       WHERE status='pending' AND ${sqlReservaLibre('', '$1')}
                       ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
          RETURNING id`, [sids[i]]).catch(() => [])));
      const ganadores = res.filter((r) => r.length).length;
      if (ganadores !== 1) fallos++;
      console.log(`│ ganadores: ${ganadores} (esperado 1)  ${ganadores === 1 ? '✅ el claim atómico aguanta' : '❌ DOS SESIONES SE LLEVARON LA MISMA FILA'}`);
    } finally { await Promise.all(cs.map((c) => c.end().catch(() => {}))); }
    console.log('└──────────────────────────────────────────────────────────────────────────────\n');

    console.log(fallos === 0 ? '✅ la reserva de la cola se comporta como dice' : `❌ ${fallos} comprobación(es) fallan`);
    process.exitCode = fallos === 0 ? 0 : 1;
  } finally {
    await s.unsafe(`DROP TABLE IF EXISTS public.${TABLA}`).catch(() => {});
    await s.end();
  }
})();
