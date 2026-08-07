#!/usr/bin/env node
// Simulación del bloque «RASTRO DE ERRORES» del dossier de feedback (T-649), contra RDS REAL.
//
// Los unitarios fijan el criterio sobre eventos escritos a mano; esto comprueba las dos cosas que
// una fixture no puede: (1) que el ANCLA —el caso que motivó el módulo— sale como debe con los
// datos de verdad, y (2) que sobre la cola reciente el bloque **enseña algo** en vez de salir
// vacío siempre (un dossier que nunca tiene nada que decir se deja de leer).
//
// Solo LEE. No escribe nada.
//
// Uso:  node scripts/impugnaciones/sim-rastro-errores.cjs [--dias 14]

const fs = require('fs');
const path = require('path');
const pg = require('postgres');
const { ventanaRastro, agruparRastro, lineasRastro } = require(path.join(__dirname, '..', '..', 'lib', 'impugnaciones', 'rastroDeErrores.cjs'));

// El caso real: Lourdes escribió que la app se colgaba al terminar un test; se le contestó con el
// bug del configurador ([T-623]) y replicó que no. Si esta simulación deja de reproducir el
// reparto ANTES/DESPUÉS, el módulo ha dejado de proteger justo del fallo para el que se hizo.
const ANCLA = {
  id: 'e790c7bf-2e74-4b5a-a363-40578844af03',
  esperaAntes: /answerSaveQueue/,     // el error del momento que ella describía
  esperaDespues: 494,                 // el 494 del configurador, POSTERIOR a su mensaje
};

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}

const eventosDe = (s, fb) => {
  const { desde, hasta } = ventanaRastro(fb.created_at);
  return s`SELECT created_at, event_type, severity, endpoint, http_status, metadata
             FROM observable_events
            WHERE user_id=${fb.user_id} AND severity IN ('error','warn')
              AND created_at BETWEEN ${desde} AND ${hasta}
            ORDER BY created_at LIMIT 500`;
};

(async () => {
  // `indexOf('--dias') + 1` sin comprobar da 0 cuando el flag no está → argv[0] es la ruta de
  // node y el número sale NaN. Se comprueba antes de leer el siguiente argumento.
  const i = process.argv.indexOf('--dias');
  const crudo = (process.argv.find((a) => a.startsWith('--dias=')) || '').split('=')[1]
    || (i > -1 ? process.argv[i + 1] : null);
  const dias = Number.isFinite(Number(crudo)) && Number(crudo) > 0 ? Number(crudo) : 14;
  const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  let fallos = 0;
  try {
    // ── 1. ANCLA ───────────────────────────────────────────────────────────────────────────
    console.log('═'.repeat(78));
    console.log('ANCLA — feedback e790c7bf (Lourdes): el caso en el que fallamos');
    console.log('═'.repeat(78));
    const [fb] = await s`SELECT id, user_id, created_at, message FROM user_feedback WHERE id=${ANCLA.id}`;
    if (!fb) {
      console.log('⚠️  el ancla ya no está en la BD — simulación NO concluyente');
      fallos++;
    } else {
      const grupos = agruparRastro(await eventosDe(s, fb), fb.created_at);
      console.log(lineasRastro(grupos, { creado: fb.created_at }).join('\n'));

      const okAntes = grupos.antes.some((g) => ANCLA.esperaAntes.test(g.componente || ''));
      const okDespues = grupos.despues.some((g) => g.http_status === ANCLA.esperaDespues);
      const noContamina = !grupos.antes.some((g) => g.http_status === ANCLA.esperaDespues);
      console.log(`\n  ${okAntes ? '✅' : '❌'} el fallo que ella describe (answerSaveQueue) aparece ANTES del mensaje`);
      console.log(`  ${okDespues ? '✅' : '❌'} el 494 del configurador aparece DESPUÉS (no explicaba su aviso)`);
      console.log(`  ${noContamina ? '✅' : '❌'} y NO se cuela entre lo anterior`);
      if (!okAntes || !okDespues || !noContamina) fallos++;
      else console.log('\n  ▶ Con este bloque delante, la respuesta que se envió se contradice sola.');
    }

    // ── 2. CALIBRACIÓN sobre la cola reciente ──────────────────────────────────────────────
    console.log('\n' + '═'.repeat(78));
    console.log(`CALIBRACIÓN — ¿enseña algo? Últimos ${dias} días de feedback de tipo bug/other`);
    console.log('═'.repeat(78));
    const recientes = await s`
      SELECT id, user_id, created_at, type FROM user_feedback
       WHERE created_at > now() - (${dias} || ' days')::interval
         AND type IN ('bug','other') AND user_id IS NOT NULL
       ORDER BY created_at DESC LIMIT 60`;
    const cuenta = { conAntes: 0, soloDespues: 0, vacio: 0 };
    for (const f of recientes) {
      const g = agruparRastro(await eventosDe(s, f), f.created_at);
      if (g.antes.length) cuenta.conAntes++;
      else if (g.despues.length) cuenta.soloDespues++;
      else cuenta.vacio++;
    }
    const n = recientes.length;
    console.log(`  feedbacks mirados: ${n}`);
    console.log(`  con rastro ANTES del mensaje: ${cuenta.conAntes}  ← evidencia utilizable`);
    console.log(`  solo rastro POSTERIOR:        ${cuenta.soloDespues}  ← justo la trampa del caso ancla`);
    console.log(`  sin rastro ninguno:           ${cuenta.vacio}  ← «no vemos nada que lo explique»`);
    if (n >= 5 && cuenta.conAntes === 0) {
      console.log('\n❌ NINGUNO tiene rastro previo: o la observabilidad no llega, o la ventana es corta.');
      fallos++;
    }

    console.log('\n' + (fallos ? `❌ SIMULACIÓN EN ROJO (${fallos})` : '✅ SIMULACIÓN EN VERDE'));
    process.exitCode = fallos ? 1 : 0;
  } finally {
    await s.end();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
