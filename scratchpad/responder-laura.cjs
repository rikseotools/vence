// Envía a Diego la respuesta aprobada por Manuel (feedback 270591ac, T-657).
const { SignJWT, importPKCS8 } = require('jose');
const fs = require('fs');

const SP = '/tmp/claude-1000/-home-manuel-vence-sessions-movil4/71a6edf6-9027-45ad-8fff-98d8fbb633a7/scratchpad';
const ADMIN_UID = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
const ADMIN_EMAIL = 'manueltrader@gmail.com';
const FEEDBACK_ID = '8bd13f67-5d76-4bcd-b457-4e45690884ce';

const MENSAJE = require('fs').readFileSync(
  '/tmp/claude-1000/-home-manuel-vence-sessions-movil4/71a6edf6-9027-45ad-8fff-98d8fbb633a7/scratchpad/borrador-laura.md',
  'utf8').trim();

(async () => {
  // PUERTA ANTES DE ENVIAR ([T-678]): lo que no se le dice a un usuario se comprueba, no se
  // recuerda. El 07/08 se colaron dos reglas ya escritas en el MISMO borrador.
  const { validarMensajeAUsuario, explicar } = require('../lib/feedback/validarMensaje.cjs');
  const v = validarMensajeAUsuario(MENSAJE);
  if (!v.ok) {
    console.error('\n🛑 NO SE ENVÍA — el mensaje incumple lo acordado:\n');
    console.error(explicar(v.incumple));
    process.exit(4);
  }

  const pem = fs.readFileSync(`${SP}/pk.txt`, 'utf8').trim();
  const kid = fs.readFileSync(`${SP}/kid.txt`, 'utf8').trim();
  const key = await importPKCS8(pem.replace(/\\n/g, '\n'), 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({ email: ADMIN_EMAIL, role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(ADMIN_UID)
    .setIssuer('https://www.vence.es')
    .setAudience('authenticated')
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);

  const res = await fetch('https://www.vence.es/api/v2/feedback/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      feedbackId: FEEDBACK_ID,
      adminUserId: ADMIN_UID,
      message: MENSAJE,
      finalStatus: 'resolved',
    }),
  });

  const txt = await res.text();
  console.log('HTTP', res.status);
  try {
    const j = JSON.parse(txt);
    console.log(JSON.stringify(j, null, 2));
    console.log(`\n  campana: ${j.bellSent ? '✅' : '❌ ' + (j.bellSkipReason ?? '')}`);
    console.log(`  email:   ${j.emailSent ? '✅ ' + (j.emailId ?? '') : '❌ ' + (j.emailSkipReason ?? j.emailError ?? '')}`);
  } catch {
    // El 504 de CloudFront devuelve HTML: la TX ya hizo commit, NO reintentar a ciegas.
    console.log('respuesta no-JSON (¿504 del proxy?):', txt.slice(0, 300));
    console.log('\n⚠️ comprobar en BD si el mensaje se insertó ANTES de reintentar (duplicaría).');
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
