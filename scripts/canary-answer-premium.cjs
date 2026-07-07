#!/usr/bin/env node
// scripts/canary-answer-premium.cjs
// Canary: un usuario PREMIUM NUNCA debe recibir un 403 de límite diario en NINGÚN
// endpoint de respuesta. Firma un token HS256 (compatible con verifyAuth mode=on,
// mismo patrón que backend/src/canary-shared/canary-token.ts) para un premium de
// prueba y hace POST con payload INVÁLIDO A PROPÓSITO a cada endpoint de respuesta.
//
// Aserción: la respuesta puede ser 400/404 (falla la validación del payload → PASÓ
// el gate de límite), pero NUNCA un 403 de "límite diario"/"dispositivo" (eso sería
// premium bloqueado = BUG). Payload inválido = no guarda nada (cero polución).
//
// Nació del incidente 07/07/2026: la ruta /api/answer/psychometric quedó desplegada
// con código stale que bloqueaba a premium; el smoke de deploy (home/asset/auth) no
// lo cazó porque no ejercía los endpoints de respuesta con identidad premium.
//
// Uso:
//   SUPABASE_JWT_SECRET=... SMOKE_PREMIUM_USER_ID=<uuid premium> \
//   BASE_URL=https://www.vence.es node scripts/canary-answer-premium.cjs
// Exit 0 = todos verdes; exit 1 = algún premium bloqueado (regresión).

const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'https://www.vence.es';
const SECRET = process.env.SUPABASE_JWT_SECRET;
// Usuario premium de smoke. Reutiliza el SMOKE_USER_ID existente (smoke@vence.es,
// plan_type=premium, ya cableado en el task def del backend). Override con
// SMOKE_PREMIUM_USER_ID si algún día se quiere un premium distinto.
const PREMIUM_ID =
  process.env.SMOKE_PREMIUM_USER_ID ||
  process.env.SMOKE_USER_ID ||
  '127063e1-1137-40ff-804d-d974818f338f';

function b64url(x) { return Buffer.from(x).toString('base64url'); }
function signHS256(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// UUID con formato VÁLIDO pero inexistente: pasa la validación Zod → llega al gate
// de límite → si premium bloqueado responde 403 (BUG cazado), si no responde 404
// "pregunta no encontrada" (pasó el gate, no guarda nada → cero polución).
// GOTCHA (incidente 07/07): un questionId con formato inválido falla Zod ANTES del
// gate (400) → el canary NO probaría el límite (falso verde). Debe ser UUID válido.
const FAKE_UUID = '00000000-0000-4000-8000-0000000000ca';
// Payloads MÍNIMOS que pasan cada esquema Zod → llegan al gate de límite. Con datos
// inexistentes: tras pasar el gate fallan en ownership/not-found (4xx/5xx), sin
// guardar. Campos requeridos según los esquemas reales de cada endpoint.
const ENDPOINTS = [
  { path: '/api/answer/psychometric', body: { questionId: FAKE_UUID, userAnswer: 0 } },
  { path: '/api/exam/answer', body: { testId: FAKE_UUID, questionOrder: 1, userAnswer: 'a' } },
  { path: '/api/v2/answer-and-save', body: { questionId: FAKE_UUID, userAnswer: 0, sessionId: FAKE_UUID, questionIndex: 0, questionText: 'canary', options: ['a', 'b'] } },
];

const isLimitBlock = (status, text) =>
  status === 403 && /límite diario|mucha demanda|dispositivo ha alcanzado/i.test(text || '');
// Un 400 = el payload NO llegó al gate (Zod lo tumbó antes) → punto ciego, NO es un
// pass fiable. Lo reportamos como warning para que el canary no dé falso verde.
const isBlindSpot = (status) => status === 400;

(async () => {
  if (!SECRET) { console.error('❌ SUPABASE_JWT_SECRET ausente → canary inactivo'); process.exit(2); }
  const now = Math.floor(Date.now() / 1000);
  const token = signHS256(
    { sub: PREMIUM_ID, aud: 'authenticated', role: 'authenticated', email: 'canary@vence.es', iss: `${BASE_URL}`, iat: now, exp: now + 120 },
    SECRET,
  );
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const failures = [];
  const warnings = [];

  // 0. Sanity: /api/daily-limit debe ver al usuario como premium
  try {
    const r = await fetch(`${BASE_URL}/api/daily-limit`, { headers: H });
    const j = await r.json().catch(() => ({}));
    if (j.isPremium !== true) { failures.push(`daily-limit: isPremium=${j.isPremium} (esperado true)`); }
    console.log(`  daily-limit → isPremium=${j.isPremium} dailyLimit=${j.dailyLimit}`);
  } catch (e) { failures.push(`daily-limit: ${e.message}`); }

  // 1. Ningún endpoint de respuesta debe bloquear a premium por límite
  for (const ep of ENDPOINTS) {
    try {
      const r = await fetch(`${BASE_URL}${ep.path}`, { method: 'POST', headers: H, body: JSON.stringify(ep.body) });
      const text = await r.text();
      const blocked = isLimitBlock(r.status, text);
      const blind = isBlindSpot(r.status);
      const tag = blocked ? '  ❌ PREMIUM BLOQUEADO' : blind ? '  ⚠️ 400: payload no llegó al gate (punto ciego)' : '  ✅ pasó el gate';
      console.log(`  POST ${ep.path.padEnd(28)} → ${r.status}${tag}`);
      if (blocked) failures.push(`${ep.path}: 403 límite a premium → ${text.slice(0, 120)}`);
      else if (blind) warnings.push(`${ep.path}: 400 — payload del canary no pasa la validación, no prueba el gate`);
    } catch (e) { failures.push(`${ep.path}: ${e.message}`); }
  }

  if (warnings.length) {
    console.warn(`\n⚠️ ${warnings.length} punto(s) ciego(s) (payload no llegó al gate — ajustar el canary):`);
    warnings.forEach(w => console.warn('   - ' + w));
  }
  if (failures.length) {
    console.error(`\n❌ CANARY ROJO — ${failures.length} fallo(s):`);
    failures.forEach(f => console.error('   - ' + f));
    process.exit(1);
  }
  console.log('\n✅ CANARY VERDE — ningún endpoint bloquea a un premium.');
  process.exit(0);
})().catch(e => { console.error('❌ canary error:', e.message); process.exit(2); });
