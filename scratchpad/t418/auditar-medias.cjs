// ¿Las tareas "implementadas y sin comprobar" están de verdad esperando un deploy,
// o su código YA está vivo y solo falta que alguien lo mire?
// Se cruza cada tarea con los commits que la DECLARAN (asunto `tipo(T-nnn):`) y se
// comprueba si están contenidos en el sha desplegado de cada superficie.
const { Client } = require('pg');
const { execSync } = require('child_process');
const { pgConfig } = require('../../lib/db/pgSsl.cjs');
require('dotenv').config({ path: __dirname + '/../../.env.local' });

const VIVO = { frontend: 'e6e8da0f', backend: 'ecdef7c0' };

const sh = (c) => { try { return execSync(c, { encoding: 'utf8' }).trim() } catch { return '' } };
const contenido = (commit, base) => sh(`git merge-base --is-ancestor ${commit} ${base} && echo SI || echo NO`) === 'SI';

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const { rows } = await c.query(`
    SELECT id, left(coalesce(resume_check,''), 400) AS falta
      FROM backlog_tasks
     WHERE resume_check IS NOT NULL AND status <> 'done'
       AND resume_check ~* '(desplegar|deploy|desplegad)'
     ORDER BY id`);
  await c.end();

  sh('git fetch origin -q');
  const out = [];
  for (const t of rows) {
    // commits cuyo ASUNTO declara la tarea (no los que solo la citan)
    const linea = sh(`git log origin/main --oneline --grep="^[a-z]*(.*${t.id}.*):" -E -5`);
    const commits = linea.split('\n').filter(Boolean).map((l) => l.split(' ')[0]);
    const front = commits.filter((x) => contenido(x, VIVO.frontend));
    const back = commits.filter((x) => contenido(x, VIVO.backend));
    out.push({
      tarea: t.id,
      commits: commits.length,
      vivos_front: front.length,
      vivos_back: back.length,
      veredicto: commits.length === 0 ? '— sin commits que la declaren'
        : (front.length === commits.length || back.length === commits.length)
          ? '✅ YA ESTÁ VIVO — se puede verificar YA'
          : front.length || back.length ? '🟡 parcialmente vivo' : '⏳ de verdad espera deploy',
      pide: /BACKEND/i.test(t.falta) && /FRONTEND/i.test(t.falta) ? 'ambos'
        : /BACKEND/i.test(t.falta) ? 'backend' : 'frontend',
    });
  }
  console.table(out);
  const ya = out.filter((o) => o.veredicto.startsWith('✅')).length;
  console.log(`\n→ ${ya} de ${out.length} tareas que dicen "falta desplegar" tienen su código YA DESPLEGADO.`);
})().catch((e) => { console.error(e.message); process.exit(1) });
