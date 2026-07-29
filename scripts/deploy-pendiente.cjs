#!/usr/bin/env node
/**
 * scripts/deploy-pendiente.cjs — ¿toca desplegar, o se sigue agrupando?
 *
 * SOLO LEE. No despliega, no escribe en BD, no toca git más allá de consultar.
 *
 * POR QUÉ EXISTE (29/07/2026)
 * ---------------------------
 * La política del proyecto es **agrupar**: una sola sesión despliega por todas. Cada deploy
 * cuesta build + minutos de Fargate, y con 2-10 sesiones pusheando a la vez, desplegar por
 * cada push multiplica ese gasto sin que nada llegue antes al usuario.
 *
 * Pero agrupar sin medir es peor que no agrupar: nadie sabía **qué hay en `main` sin desplegar
 * ni quién lo está esperando**, así que la decisión de desplegar se tomaba por sensación. Y el
 * coste de esperar de más no es teórico: una tarea pausada con `--tras-deploy` es **trabajo ya
 * terminado que no se puede cerrar** hasta que su commit esté vivo.
 *
 * La pregunta que contesta no es "¿hay algo sin desplegar?" (casi siempre sí), sino
 * **"¿hay alguien esperándolo?"**.
 *
 * Cómo lo sabe, sin inventarse fuentes nuevas:
 *   · el sha VIVO de cada superficie → `/api/health` (`deploy`), que ya es la fuente de verdad
 *     del runbook de despliegue (las notas de memoria envejecen; el health, no);
 *   · qué falta por desplegar → `git log <sha_vivo>..origin/main`, acotado por RUTAS para no
 *     contar como deuda de backend un commit que solo tocó el frontend;
 *   · quién lo espera → `backlog_tasks.wake_on_deploy_sha`, que ya rellena `pause --tras-deploy`.
 *
 * El veredicto lo pone el núcleo puro `deployDebtLevel` (`lib/backlog/claimGate.cjs`), testeado
 * en `__tests__/backlog/claim.test.ts` — aquí solo vive la I/O.
 *
 * Uso:  npm run deploy:pendiente          (o: node scripts/deploy-pendiente.cjs)
 *       npm run deploy:pendiente -- --json
 */
require('dotenv').config({ path: '.env.local' });
const path = require('path');
const { execFileSync } = require('child_process');
const postgres = require('postgres');
const { deployDebtLevel } = require(path.join(__dirname, '..', 'lib', 'backlog', 'claimGate.cjs'));

const REPO = path.join(__dirname, '..');
const JSON_OUT = process.argv.includes('--json');

const HEALTH = {
  frontend: 'https://www.vence.es/api/health',
  backend: 'https://api.vence.es/health',
};

/**
 * Rutas que hacen que un commit cuente como deuda de CADA superficie.
 *
 * El backend se despliega solo con lo suyo; el frontend, con todo lo demás. Sin este reparto,
 * un commit de documentación aparecería como "backend sin desplegar" y empujaría a desplegar
 * algo que no cambia nada — justo el gasto que la política de agrupar quiere evitar.
 */
const SUPERFICIE_PATHS = {
  backend: ['backend/'],
  frontend: ['app/', 'components/', 'lib/', 'contexts/', 'hooks/', 'utils/', 'db/', 'public/', 'middleware.ts', 'next.config.js', 'package.json'],
};

function git(args) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
}

async function shaVivo(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    return j?.deploy ?? null;
  } catch (e) {
    return { error: e.message };
  }
}

function commitsPendientes(shaBase, rutas) {
  try {
    // `--` acota por rutas: solo cuenta lo que de verdad afecta a esa superficie.
    const out = git(['log', '--oneline', `${shaBase}..origin/main`, '--', ...rutas]);
    return out ? out.split('\n') : [];
  } catch {
    // Un sha que ya no está en el repo local (rebase, purga) no debe tumbar el diagnóstico.
    return null;
  }
}

(async () => {
  git(['fetch', 'origin', '--quiet']);

  const vivos = {
    frontend: await shaVivo(HEALTH.frontend),
    backend: await shaVivo(HEALTH.backend),
  };

  const sql = postgres(process.env.DATABASE_URL, {
    max: 1, prepare: false, ssl: { rejectUnauthorized: false },
  });
  const esperando = await sql`
    SELECT id, title, wake_on_deploy_sha, wake_on_deploy_surface, resume_check
      FROM public.backlog_tasks
     WHERE wake_on_deploy_sha IS NOT NULL AND status IN ('open','in_progress','blocked')
     ORDER BY id`;
  await sql.end();

  const informe = {};
  for (const sup of ['frontend', 'backend']) {
    const vivo = vivos[sup];
    if (!vivo || vivo.error) {
      informe[sup] = { error: vivo?.error || 'sin respuesta de /health' };
      continue;
    }
    const commits = commitsPendientes(vivo, SUPERFICIE_PATHS[sup]);
    // Una tarea que espera `both` cuenta para las DOS: mientras a una le falte, no se cierra.
    const tareas = esperando.filter(
      (t) => (t.wake_on_deploy_surface || 'both') === sup || (t.wake_on_deploy_surface || 'both') === 'both',
    );
    informe[sup] = {
      vivo,
      commits: commits === null ? null : commits.length,
      muestra: commits ? commits.slice(0, 5) : [],
      tareasEsperando: tareas.length,
      tareas: tareas.map((t) => ({ id: t.id, falta: t.resume_check })),
      veredicto: deployDebtLevel({
        commits: commits === null ? 0 : commits.length,
        tareasEsperando: tareas.length,
      }),
    };
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(informe, null, 2));
    return;
  }

  const ICONO = { 'al-dia': '🟢', acumulando: '🟡', 'toca-desplegar': '🔴' };
  console.log('\n¿Toca desplegar?  (política: AGRUPAR — una sola sesión despliega por todas)\n');
  for (const sup of ['frontend', 'backend']) {
    const i = informe[sup];
    if (i.error) {
      console.log(`  ${sup.padEnd(9)} ⚠️  no se pudo leer /health: ${i.error}`);
      continue;
    }
    const v = i.veredicto;
    console.log(`  ${sup.padEnd(9)} ${ICONO[v.nivel]} ${v.nivel.toUpperCase()} — vivo ${i.vivo} · ${i.commits ?? '?'} commit(s) sin desplegar`);
    console.log(`            ${v.motivo}`);
    for (const t of i.tareas) {
      console.log(`            ▶ ${t.id}: ${String(t.falta || '').slice(0, 90)}`);
    }
    for (const c of i.muestra) console.log(`              · ${c.slice(0, 88)}`);
    if (i.commits > i.muestra.length) console.log(`              … y ${i.commits - i.muestra.length} más`);
  }
  const alguno = Object.values(informe).some((i) => i.veredicto?.nivel === 'toca-desplegar');
  console.log(
    alguno
      ? '\n  → Hay trabajo TERMINADO esperando: desplegar cierra tareas. `scripts/deploy-cuando-verde.sh <superficie>`\n'
      : '\n  → Nadie espera nada: se puede seguir agrupando.\n',
  );
})().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
