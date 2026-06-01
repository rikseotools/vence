#!/usr/bin/env node
/**
 * analyze-pool-capture.cjs — Análisis estructurado del JSON-line producido por
 * `capture-pool-pressure.cjs`.
 *
 * Lee el archivo de captura, identifica automáticamente la ventana del pico
 * (minuto con más errores 5xx) y aplica análisis por hipótesis del roadmap
 * `docs/roadmap/pool-segregation.md`:
 *
 *   - HIPÓTESIS A (Supavisor blip externo): conexiones Supavisor con
 *     wait_event=ClientRead/ClientWrite >10s durante el pico.
 *   - HIPÓTESIS B (after() retiene slot): conexiones postgres-js en estado
 *     "idle in transaction" >5s, o queries activas >5s con app=postgres-js.
 *   - HIPÓTESIS C (cache miss post-deploy): burst de errores 5xx <90s después
 *     de un cambio observado en deploys_recent.
 *
 * Cada hipótesis se reporta como CONFIRMADA, DESCARTADA o INCONCLUSO con
 * la evidencia exacta. Al final, recomienda qué Fase del roadmap ejecutar.
 *
 * Uso:
 *   node scripts/diagnostic/analyze-pool-capture.cjs --input /tmp/pool-pressure-2026-06-01.jsonl
 *   node scripts/diagnostic/analyze-pool-capture.cjs --input ... --json   # output JSON estructurado
 *   node scripts/diagnostic/analyze-pool-capture.cjs --input ... --window 09:00-10:30  # ventana manual UTC
 *
 * Seguridad: read-only sobre fichero local. NO conecta a BD. Coste 0.
 */

const fs = require('fs');
const path = require('path');

// ─── CLI args ────────────────────────────────────────────────────────────────
function getArg(name, defaultVal) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--' + name);
  if (i === -1) return defaultVal;
  // Flags booleanos (--json) sin valor siguiente
  if (i === args.length - 1 || args[i + 1].startsWith('--')) return true;
  return args[i + 1];
}

const INPUT_PATH = getArg('input', null);
const OUTPUT_JSON = getArg('json', false);
const MANUAL_WINDOW = getArg('window', null); // formato "HH:MM-HH:MM" UTC

if (!INPUT_PATH) {
  console.error('Uso: node analyze-pool-capture.cjs --input <ruta.jsonl> [--json] [--window HH:MM-HH:MM]');
  process.exit(1);
}

if (!fs.existsSync(INPUT_PATH)) {
  console.error(`Archivo no encontrado: ${INPUT_PATH}`);
  process.exit(1);
}

// ─── Leer y parsear samples ─────────────────────────────────────────────────
const samples = fs
  .readFileSync(INPUT_PATH, 'utf-8')
  .split('\n')
  .filter((l) => l.trim().length > 0)
  .map((line, idx) => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.error(`Línea ${idx + 1} no es JSON válido — saltada: ${e.message}`);
      return null;
    }
  })
  .filter((s) => s !== null);

if (samples.length === 0) {
  console.error('No hay samples válidos en el archivo.');
  process.exit(1);
}

// ─── Identificar ventana del pico ────────────────────────────────────────────
function findPeakWindow(samples) {
  // Si el usuario forzó ventana manual con --window HH:MM-HH:MM, respetar.
  if (MANUAL_WINDOW) {
    const [start, end] = MANUAL_WINDOW.split('-');
    const dayPrefix = samples[0].ts.slice(0, 10);
    return {
      startMs: new Date(`${dayPrefix}T${start}:00Z`).getTime(),
      endMs: new Date(`${dayPrefix}T${end}:00Z`).getTime(),
      reason: `ventana manual ${MANUAL_WINDOW} UTC`,
    };
  }

  // Auto: encontrar el minuto con más errores 5xx, expandir ±5 min.
  let peakIdx = 0;
  let peakErrors = -1;
  for (let i = 0; i < samples.length; i++) {
    const errs = samples[i].errors_recent?.total_5xx_30s ?? 0;
    if (errs > peakErrors) {
      peakErrors = errs;
      peakIdx = i;
    }
  }
  const peakMs = new Date(samples[peakIdx].ts).getTime();
  return {
    startMs: peakMs - 5 * 60 * 1000,
    endMs: peakMs + 5 * 60 * 1000,
    reason: `auto: pico de ${peakErrors} errores 5xx a las ${samples[peakIdx].ts.slice(11, 19)} UTC`,
  };
}

const window = findPeakWindow(samples);
const inWindow = samples.filter((s) => {
  const ms = new Date(s.ts).getTime();
  return ms >= window.startMs && ms <= window.endMs;
});

// ─── Análisis por hipótesis ─────────────────────────────────────────────────

/**
 * HIPÓTESIS A — Supavisor blip externo.
 * Evidencia: conexiones con application_name='Supavisor' y wait_event=ClientRead
 * o ClientWrite con query_age o state_age > 10s. Eso indica que Supavisor
 * está esperando al cliente o vice-versa con latencia anómala.
 */
function analyzeHypothesisA(samples) {
  const supavisorHungSamples = [];
  for (const s of samples) {
    const hung = (s.pg_stat?.long_active_over_5s ?? [])
      .concat(s.pg_stat?.idle_in_tx_over_5s ?? [])
      .filter(
        (c) =>
          c.app === 'Supavisor' &&
          (c.wait?.includes('ClientRead') ||
            c.wait?.includes('ClientWrite')),
      );
    if (hung.length > 0) {
      supavisorHungSamples.push({
        ts: s.ts,
        count: hung.length,
        examples: hung.slice(0, 3).map((c) => ({
          pid: c.pid,
          wait: c.wait,
          age_s: c.query_age_s ?? c.state_age_s,
        })),
      });
    }
  }

  let verdict;
  if (supavisorHungSamples.length === 0) {
    verdict = 'DESCARTADA';
  } else if (supavisorHungSamples.length >= 3) {
    verdict = 'CONFIRMADA';
  } else {
    verdict = 'INCONCLUSO';
  }

  return {
    name: 'A — Supavisor blip externo',
    verdict,
    evidence: {
      samples_with_supavisor_hung: supavisorHungSamples.length,
      total_samples_in_window: samples.length,
      details: supavisorHungSamples.slice(0, 5),
    },
    fixIfConfirmed: 'Fase 1 — migrar getDb() (path principal) al self-hosted pooler con max:8.',
  };
}

/**
 * HIPÓTESIS B — `after()` o algo similar retiene slot pool postgres-js.
 * Evidencia: conexiones con application_name='postgres-js' en estado
 * "idle in transaction" >5s, o activas >5s sin razón clara (pool dedicado al
 * frontend está colgado mientras espera Stripe/red).
 */
function analyzeHypothesisB(samples) {
  const pgHungSamples = [];
  for (const s of samples) {
    const idleInTxApp = (s.pg_stat?.idle_in_tx_over_5s ?? []).filter(
      (c) => c.app === 'postgres-js',
    );
    const longActiveApp = (s.pg_stat?.long_active_over_5s ?? []).filter(
      (c) => c.app === 'postgres-js',
    );
    const totalHung = idleInTxApp.length + longActiveApp.length;
    if (totalHung > 0) {
      pgHungSamples.push({
        ts: s.ts,
        idle_in_tx: idleInTxApp.length,
        long_active: longActiveApp.length,
        examples: [...idleInTxApp, ...longActiveApp].slice(0, 3).map((c) => ({
          pid: c.pid,
          state_or_wait: c.wait,
          age_s: c.state_age_s ?? c.query_age_s,
          query_preview: c.query?.slice(0, 100),
        })),
      });
    }
  }

  let verdict;
  if (pgHungSamples.length === 0) {
    verdict = 'DESCARTADA';
  } else if (pgHungSamples.length >= 3) {
    verdict = 'CONFIRMADA';
  } else {
    verdict = 'INCONCLUSO';
  }

  return {
    name: 'B — after()/background retiene slot postgres-js',
    verdict,
    evidence: {
      samples_with_pg_hung: pgHungSamples.length,
      total_samples_in_window: samples.length,
      details: pgHungSamples.slice(0, 5),
    },
    fixIfConfirmed:
      'Fase 2 — pool dedicado getBackgroundDb() para after()/reconcileUserPremium, o mover a cola async (Redis queue + worker Fargate).',
  };
}

/**
 * HIPÓTESIS C — cache miss masivo post-deploy.
 * Evidencia: burst de errores 5xx en ventana 30-90 s tras aparición de un
 * deploy_version nuevo en deploys_recent.
 */
function analyzeHypothesisC(samples) {
  // Construir línea temporal de deploy versions vistas.
  const deployFirstSeenMs = new Map(); // version -> ms del primer sample que la ve
  for (const s of samples) {
    for (const d of s.deploys_recent ?? []) {
      if (d.version && !deployFirstSeenMs.has(d.version)) {
        deployFirstSeenMs.set(d.version, new Date(s.ts).getTime());
      }
    }
  }

  // Para cada burst de errores >5/30s, mirar si hay deploy en los 30-90s previos.
  const bursts = [];
  for (const s of samples) {
    const errs = s.errors_recent?.total_5xx_30s ?? 0;
    if (errs >= 5) {
      const burstMs = new Date(s.ts).getTime();
      const recentDeploys = [...deployFirstSeenMs.entries()]
        .filter(([_, firstSeen]) => {
          const diff = burstMs - firstSeen;
          return diff >= 0 && diff <= 90 * 1000;
        })
        .map(([version, firstSeen]) => ({
          version,
          seconds_before_burst: Math.round((burstMs - firstSeen) / 1000),
        }));
      bursts.push({
        ts: s.ts,
        errors_5xx_30s: errs,
        deploys_in_last_90s: recentDeploys,
      });
    }
  }

  const burstsWithDeploy = bursts.filter((b) => b.deploys_in_last_90s.length > 0);

  let verdict;
  if (bursts.length === 0) {
    verdict = 'DESCARTADA (sin bursts de errores en ventana)';
  } else if (burstsWithDeploy.length / bursts.length >= 0.5) {
    verdict = 'CONFIRMADA';
  } else if (burstsWithDeploy.length > 0) {
    verdict = 'INCONCLUSO';
  } else {
    verdict = 'DESCARTADA';
  }

  return {
    name: 'C — Cache miss masivo post-deploy',
    verdict,
    evidence: {
      total_bursts_5xx: bursts.length,
      bursts_with_deploy_in_90s: burstsWithDeploy.length,
      deploys_seen_in_capture: [...deployFirstSeenMs.keys()],
      details: burstsWithDeploy.slice(0, 5),
    },
    fixIfConfirmed:
      'Fase 3 — Redis cache (Upstash) para getProfileForSelf, sobrevive a deploys (unstable_cache se invalida tras cada redeploy).',
  };
}

// ─── Resumen ejecutivo ──────────────────────────────────────────────────────
function buildSummary(samples, window, inWindow) {
  const totalErrors = samples.reduce(
    (acc, s) => acc + (s.errors_recent?.total_5xx_30s ?? 0),
    0,
  );
  const peakActive = samples.reduce(
    (max, s) => Math.max(max, s.pg_stat?.active_app_conns ?? 0),
    0,
  );
  const peakTotalConns = samples.reduce(
    (max, s) => Math.max(max, s.pg_stat?.total_conns ?? 0),
    0,
  );
  const idleInTxTotal = samples.reduce(
    (acc, s) => acc + (s.pg_stat?.idle_in_tx_over_5s?.length ?? 0),
    0,
  );
  const longActiveTotal = samples.reduce(
    (acc, s) => acc + (s.pg_stat?.long_active_over_5s?.length ?? 0),
    0,
  );

  return {
    capture_file: INPUT_PATH,
    total_samples: samples.length,
    first_sample: samples[0].ts,
    last_sample: samples[samples.length - 1].ts,
    duration_min: Math.round(
      (new Date(samples[samples.length - 1].ts).getTime() -
        new Date(samples[0].ts).getTime()) /
        60000,
    ),
    peak_window: {
      reason: window.reason,
      start: new Date(window.startMs).toISOString().slice(11, 19),
      end: new Date(window.endMs).toISOString().slice(11, 19),
      samples_in_window: inWindow.length,
    },
    totals: {
      errors_5xx_all_samples: totalErrors,
      peak_active_postgres_js_conns: peakActive,
      peak_total_conns: peakTotalConns,
      samples_with_idle_in_tx_over_5s: idleInTxTotal,
      samples_with_long_active_over_5s: longActiveTotal,
    },
  };
}

// ─── Recomendación final ────────────────────────────────────────────────────
function recommend(hypotheses) {
  const confirmed = hypotheses.filter((h) => h.verdict === 'CONFIRMADA');
  const inconclusive = hypotheses.filter((h) => h.verdict === 'INCONCLUSO');

  if (confirmed.length === 0 && inconclusive.length === 0) {
    return {
      action: 'Fase 4 del roadmap pool-segregation — instrumentar más fino (tracing OpenTelemetry, trace_id en withDbTimeout) y re-capturar.',
      reason: 'Ninguna hipótesis se confirma con la evidencia capturada. Necesitamos más telemetría antes de actuar.',
    };
  }

  if (confirmed.length === 1) {
    return {
      action: confirmed[0].fixIfConfirmed,
      reason: `Hipótesis ${confirmed[0].name} confirmada por la evidencia capturada. Ejecutar la fase correspondiente del roadmap.`,
    };
  }

  if (confirmed.length > 1) {
    return {
      action: 'Ejecutar las fases correspondientes a las hipótesis confirmadas EN PARALELO (afectan a sistemas distintos).',
      reason: `${confirmed.length} hipótesis confirmadas: ${confirmed.map((h) => h.name).join(', ')}. Probablemente se amplifican entre sí.`,
    };
  }

  // Solo inconclusos
  return {
    action: 'Re-capturar mañana con --duration extendido (2-3 h) o reducir interval a 10s durante el pico.',
    reason: `Hipótesis inconclusas: ${inconclusive.map((h) => h.name).join(', ')}. Más muestreo necesario antes de fijar diagnóstico.`,
  };
}

// ─── Ejecución principal ────────────────────────────────────────────────────
const hypotheses = [
  analyzeHypothesisA(inWindow),
  analyzeHypothesisB(inWindow),
  analyzeHypothesisC(samples), // C usa la línea temporal completa, no la ventana
];
const summary = buildSummary(samples, window, inWindow);
const recommendation = recommend(hypotheses);

const report = { summary, hypotheses, recommendation };

if (OUTPUT_JSON) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

// ─── Output legible humano ──────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('  ANÁLISIS POOL CAPTURE — pool-segregation roadmap');
console.log('═══════════════════════════════════════════════════════════════');
console.log();
console.log('📂 Capture:', summary.capture_file);
console.log(`   ${summary.total_samples} samples, ${summary.duration_min} min`);
console.log(`   ${summary.first_sample.slice(11, 19)} → ${summary.last_sample.slice(11, 19)} UTC`);
console.log();
console.log('🎯 Ventana del pico:', summary.peak_window.reason);
console.log(`   ${summary.peak_window.start} → ${summary.peak_window.end} UTC`);
console.log(`   ${summary.peak_window.samples_in_window} samples analizados`);
console.log();
console.log('📊 Totales en la captura completa:');
console.log(`   - Errores 5xx (suma): ${summary.totals.errors_5xx_all_samples}`);
console.log(`   - Pico conn activas postgres-js: ${summary.totals.peak_active_postgres_js_conns}`);
console.log(`   - Pico conn totales: ${summary.totals.peak_total_conns}`);
console.log(`   - Samples con idle-in-tx>5s: ${summary.totals.samples_with_idle_in_tx_over_5s}`);
console.log(`   - Samples con long-active>5s: ${summary.totals.samples_with_long_active_over_5s}`);
console.log();

const ICONS = { CONFIRMADA: '🔴', INCONCLUSO: '🟡', DESCARTADA: '🟢' };
const ICONS_VERDICT = (v) => {
  for (const key of Object.keys(ICONS)) if (v.startsWith(key)) return ICONS[key];
  return '⚪';
};

for (const h of hypotheses) {
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`HIPÓTESIS ${h.name}`);
  console.log(`Veredicto: ${ICONS_VERDICT(h.verdict)} ${h.verdict}`);
  console.log();
  console.log('Evidencia:');
  for (const [k, v] of Object.entries(h.evidence)) {
    if (k === 'details') {
      console.log(`   ${k}:`);
      if (Array.isArray(v) && v.length === 0) console.log('     (vacío)');
      else
        for (const d of v) {
          console.log('     -', JSON.stringify(d).slice(0, 250));
        }
    } else {
      console.log(`   ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    }
  }
  console.log();
  console.log(`Si confirmada → ${h.fixIfConfirmed}`);
  console.log();
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('  RECOMENDACIÓN');
console.log('═══════════════════════════════════════════════════════════════');
console.log(recommendation.action);
console.log();
console.log('Razón:', recommendation.reason);
console.log();
