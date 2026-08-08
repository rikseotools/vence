// Verificación determinista del arreglo de estadísticas ([T-671]): llama al endpoint como lo hace
// el navegador, con el token de usuarios REALES que lo sufrieron. No depende del tráfico ajeno.
const { SignJWT, importPKCS8 } = require('jose');
const fs = require('fs');
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

const SP = '/tmp/claude-1000/-home-manuel-vence-sessions-movil4/71a6edf6-9027-45ad-8fff-98d8fbb633a7/scratchpad';
const CORREOS = ['laurasimar@gmail.com', 'rbsc87@gmail.com'];

(async () => {
  const key = await importPKCS8(fs.readFileSync(`${SP}/pk.txt`, 'utf8').trim().replace(/\\n/g, '\n'), 'RS256');
  const kid = fs.readFileSync(`${SP}/kid.txt`, 'utf8').trim();
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  let fallos = 0;
  for (const email of CORREOS) {
    const u = (await c.query('SELECT id FROM user_profiles WHERE email=$1', [email])).rows[0];
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ email, role: 'authenticated' })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setSubject(u.id).setIssuer('https://www.vence.es').setAudience('authenticated')
      .setIssuedAt(now).setExpirationTime(now + 300).sign(key);

    for (const [nombre, ruta] of [
      ['estadísticas', `/api/v2/user-stats?userId=${u.id}`],
      ['exámenes pendientes', `/api/exam/pending?userId=${u.id}&testType=exam&limit=10`],
    ]) {
      const r = await fetch(`https://www.vence.es${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
      const b = await r.json().catch(() => null);
      const ok = r.status === 200 && b?.success !== false;
      if (!ok) fallos++;
      const extra = nombre === 'estadísticas' && b
        ? ` · preguntas: ${b.totalQuestions ?? '?'} · racha: ${b.currentStreak ?? '?'}`
        : b?.exams ? ` · ${b.exams.length} pendiente(s)` : '';
      console.log(`   ${ok ? '✅' : '❌'} ${email.padEnd(24)} ${nombre.padEnd(20)} HTTP ${r.status}${extra}`);
    }
  }
  await c.end();
  console.log(fallos === 0
    ? '\n✅ VERIFICADO: los endpoints que devolvían 401 responden 200 con datos reales.'
    : `\n❌ ${fallos} llamada(s) siguen fallando.`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
