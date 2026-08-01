#!/usr/bin/env node
// scripts/backlog/sanear-marca-desplegado.cjs
//
// Saneo ÚNICO de las tareas que ya se despertaron ANTES de que existiera la marca ([T-463]).
//
// El arreglo de [T-463] marca el pendiente en el momento de despertar, pero solo sirve de aquí
// en adelante: las que ya se despertaron siguen diciendo «falta desplegar» con el código vivo
// desde hace horas. Medido el 01/08: 10 de 10, tres de ellas críticas y varias de dinero.
//
// CRITERIO, y es estrecho a propósito: solo se toca una tarea si **TODOS** los commits cuyo
// ASUNTO la declara están contenidos en el sha vivo de alguna superficie. Si queda uno fuera,
// la tarea SÍ espera un deploy de verdad y marcarla sería mentir en la otra dirección.
//
// Añade, nunca borra (mismo criterio que el núcleo).
//
// Uso:  node scripts/backlog/sanear-marca-desplegado.cjs [--apply]
const { Client } = require('pg');
const { execSync } = require('child_process');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
const { marcarDesplegado } = require('../../lib/backlog/marcaDesplegado.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

const APPLY = process.argv.includes('--apply');

const sh = (c) => { try { return execSync(c, { encoding: 'utf8' }).trim(); } catch { return ''; } };
const contenido = (commit, base) =>
  sh(`git merge-base --is-ancestor ${commit} ${base} && echo SI || echo NO`) === 'SI';

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  // Sha vivo de cada superficie: se pregunta al MISMO sitio que `deploy:pendiente` (el /health
  // de cada servicio), no a una tabla. No hay otra fuente de verdad de qué está corriendo.
  const HEALTH = {
    frontend: 'https://www.vence.es/api/health',
    backend: 'https://api.vence.es/health',
  };
  const vivo = {};
  for (const [sup, url] of Object.entries(HEALTH)) {
    try {
      const j = await (await fetch(url, { signal: AbortSignal.timeout(15000) })).json();
      vivo[sup] = typeof j?.deploy === 'string' ? j.deploy : null;
    } catch { vivo[sup] = null; }
  }
  console.log(`sha vivo → frontend=${vivo.frontend || '?'} · backend=${vivo.backend || '?'}`);
  if (!vivo.frontend && !vivo.backend) {
    console.error('❌ sin sha vivo: no se puede decidir nada. Aborta.');
    process.exit(1);
  }

  const { rows } = await c.query(`
    SELECT id, resume_check FROM backlog_tasks
     WHERE status <> 'done' AND resume_check IS NOT NULL
       AND resume_check ~* '(despleg|deploy)'
       AND wake_on_deploy_sha IS NULL
     ORDER BY id`);

  sh('git fetch origin -q');
  let tocadas = 0;
  for (const t of rows) {
    const linea = sh(`git log origin/main --oneline -E --grep="^[a-z]+\\(.*${t.id}.*\\):" -20`);
    const commits = linea.split('\n').filter(Boolean).map((l) => l.split(' ')[0]);
    if (!commits.length) { console.log(`· ${t.id}  — sin commits que la declaren, se deja`); continue; }

    const surf = ['frontend', 'backend'].find(
      (s) => vivo[s] && commits.every((x) => contenido(x, vivo[s])),
    );
    if (!surf) { console.log(`· ${t.id}  ⏳ espera deploy DE VERDAD (${commits.length} commit(s) fuera del vivo)`); continue; }

    const nuevo = marcarDesplegado(t.resume_check, vivo[surf]);
    if (!nuevo) { console.log(`· ${t.id}  — ya marcada o sin nada que marcar`); continue; }

    tocadas++;
    console.log(`${APPLY ? '✍️ ' : '· '}${t.id}  ✅ ya vivo en ${surf} (${String(vivo[surf]).slice(0, 8)})`);
    if (APPLY) {
      await c.query('UPDATE backlog_tasks SET resume_check=$2 WHERE id=$1', [t.id, nuevo]);
    }
  }

  console.log(`\n${tocadas} tarea(s) ${APPLY ? 'MARCADAS' : 'se marcarían'} como ya desplegadas.`);
  if (!APPLY && tocadas) console.log('   → repite con --apply para escribirlo.');
  await c.end();
})().catch((e) => { console.error('💥', e.message); process.exit(1); });
