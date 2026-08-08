// Cierre SILENCIOSO de un feedback (sin mensaje: ni campana ni email).
// Para agradecimientos y duplicados — la regla de la casa: un «gracias» no necesita respuesta,
// y contestarlo genera un aviso más a alguien que ya está satisfecho.
const { SignJWT, importPKCS8 } = require('jose');
const fs = require('fs');

const SP = '/tmp/claude-1000/-home-manuel-vence-sessions-movil4/71a6edf6-9027-45ad-8fff-98d8fbb633a7/scratchpad';
const ADMIN_UID = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
const ADMIN_EMAIL = 'manueltrader@gmail.com';
const FEEDBACK_ID = process.argv[2];

(async () => {
  if (!FEEDBACK_ID) throw new Error('falta el feedback id');
  const key = await importPKCS8(fs.readFileSync(`${SP}/pk.txt`, 'utf8').trim().replace(/\\n/g, '\n'), 'RS256');
  const kid = fs.readFileSync(`${SP}/kid.txt`, 'utf8').trim();
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({ email: ADMIN_EMAIL, role: 'authenticated' })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(ADMIN_UID).setIssuer('https://www.vence.es').setAudience('authenticated')
    .setIssuedAt(now).setExpirationTime(now + 300).sign(key);

  const res = await fetch('https://www.vence.es/api/v2/feedback/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    // SIN `message`: no inserta mensaje, no manda campana ni email. Solo cierra.
    body: JSON.stringify({ feedbackId: FEEDBACK_ID, adminUserId: ADMIN_UID, finalStatus: 'resolved' }),
  });
  const j = await res.json().catch(() => null);
  console.log('HTTP', res.status, JSON.stringify(j));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
