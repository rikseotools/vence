import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const admin = createClient(SUPA_URL, SVC, { auth: { persistSession: false } });
const resend = new Resend(process.env.RESEND_API_KEY);

const QID = '99d8dd25-6f0b-430b-841d-18324dd719f8';
const DISPUTE_ID = '9542f8df-10d6-4568-a436-4c07d9275fd8';
const UID = '1c43b5a1-f463-4a7c-bb94-8130d6ed9293';
const EMAIL_LOOKUP = true;
const ADMIN_EMAIL = 'manueltrader@gmail.com';
const STATUS = 'resolved';

const NEW_Q = 'Ley Orgánica 1/1981, del Estatuto de autonomía para Galicia. De acuerdo con el artículo 11 del EAG, señale la afirmación INCORRECTA:';
const NEW_D = 'Una ley del Parlamento de Galicia fijará el número de Diputados entre cincuenta y setenta.';
const NEW_CORRECT = 3;

const NEW_EXP = `La pregunta pide señalar la afirmación INCORRECTA según el artículo 11 del Estatuto de Autonomía de Galicia (LO 1/1981). La respuesta correcta es D.

**A) CORRECTA (afirmación verdadera)** - Reproduce el art. 11.Uno: el Parlamento se constituye por Diputados elegidos por sufragio universal, igual, libre, directo y secreto.

**B) CORRECTA (afirmación verdadera)** - Reproduce el art. 11.Dos: el Parlamento se elige por cuatro años con un sistema de representación proporcional que asegure la representación de las diversas zonas del territorio gallego.

**C) CORRECTA (afirmación verdadera)** - Reproduce el art. 11.Cuatro: la circunscripción electoral será, en todo caso, la provincia.

**D) INCORRECTA (es la que hay que señalar)** - El art. 11.Cinco fija el número de Diputados entre SESENTA y OCHENTA, no entre cincuenta y setenta.`;

const MENSAJE = `Hola Pilar,

Tienes razón: la pregunta no tenía una única respuesta correcta. Las cuatro opciones reproducían apartados literales del artículo 11 del Estatuto de Autonomía de Galicia (el sufragio, el plazo de cuatro años, la circunscripción provincial y el mandato no imperativo), así que todas eran verdaderas y no había forma de elegir una sola.

Hemos reformulado la pregunta para que pida señalar la afirmación INCORRECTA e introducido una opción falsa (el número de diputados, que el artículo 11.Cinco fija entre sesenta y ochenta). Así la pregunta queda con una única respuesta válida.

Muchas gracias.

Equipo de Vence`;

const VERIF_EXP = 'Revisión humana tras impugnación 9542f8df (Pilar Freire, desacuerdo_correcta). La pregunta "señale la correcta" del art 11 EAG tenía las 4 opciones literalmente verdaderas (11.Uno, 11.Dos, 11.Cuatro, 11.Siete) → sin respuesta única. Reformulada a "señale la INCORRECTA"; opción D cambiada a afirmación falsa (nº diputados: el art 11.Cinco fija entre sesenta y ochenta). correct_option=3.';

async function mintBearer() {
  const { data: linkData } = await admin.auth.admin.generateLink({ type: 'magiclink', email: ADMIN_EMAIL });
  const anon = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
  const { data: verifyData } = await anon.auth.verifyOtp({ type: 'email', token_hash: linkData.properties.hashed_token });
  return verifyData.session.access_token;
}
async function fallbackEmailBell(email) {
  const preview = MENSAJE.length > 100 ? MENSAJE.slice(0, 100) + '...' : MENSAJE;
  await admin.from('notification_logs').insert({ user_id: UID, message_sent: `El equipo de Vence: "${preview}"`, delivery_status: 'sent', context_data: { type: 'dispute_response', title: 'Respuesta a tu impugnación', dispute_id: DISPUTE_ID } });
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'info@vence.es';
  const fromName = process.env.EMAIL_FROM_NAME || 'Vence.es';
  const disputeUrl = `https://www.vence.es/soporte?tab=impugnaciones&dispute_id=${DISPUTE_ID}`;
  const html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;"><h1 style="color: white; margin: 0; font-size: 20px;">Vence.es</h1></div><div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;"><p style="color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-line;">${MENSAJE.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p><hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" /><p style="color: #6b7280; font-size: 13px;">Detalle en tu panel: <a href="${disputeUrl}" style="color: #2563eb;">${disputeUrl}</a></p></div></div>`;
  const { data: er, error: ee } = await resend.emails.send({ from: `${fromName} <${fromAddress}>`, to: [email], subject: 'Respuesta a tu impugnación — Vence', replyTo: fromAddress, html });
  console.log('Resend fallback:', ee ? 'ERR ' + ee.message : 'OK id=' + er?.id);
}
async function main() {
  console.log('=== PASO 1: UPDATE enunciado + opción D + correct_option + explicación ===');
  const { data: u1, error: e1 } = await admin.from('questions').update({ question_text: NEW_Q, option_d: NEW_D, correct_option: NEW_CORRECT, explanation: NEW_EXP, verified_at: new Date().toISOString(), verification_status: 'verified' }).eq('id', QID).select('id, correct_option, lifecycle_state, is_active');
  if (e1) { console.error('ERR:', e1); process.exit(1); }
  console.log('OK:', u1);

  console.log('\n=== PASO 2: UPDATE/INSERT verif (claude_code) ===');
  const { data: u2 } = await admin.from('ai_verification_results').update({ ai_model: 'claude-opus-4-8', answer_ok: true, explanation_ok: true, article_ok: true, confidence: 'alta', verified_at: new Date().toISOString(), explanation: VERIF_EXP }).eq('question_id', QID).eq('ai_provider', 'claude_code').select('id');
  if (!u2 || u2.length === 0) {
    const { error: e2b } = await admin.from('ai_verification_results').insert({ question_id: QID, ai_provider: 'claude_code', ai_model: 'claude-opus-4-8', answer_ok: true, explanation_ok: true, article_ok: true, confidence: 'alta', verified_at: new Date().toISOString(), explanation: VERIF_EXP });
    console.log('INSERT verif:', e2b ? 'ERR ' + e2b.message : 'OK');
  } else console.log('UPDATE verif OK:', u2);

  console.log('\n=== PASO 3: Revalidate cache ===');
  const r = await fetch('https://www.vence.es/api/admin/revalidate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET }, body: JSON.stringify({ tag: 'questions' }) });
  console.log('Status:', r.status, '|', (await r.text()).substring(0, 80));

  console.log(`\n=== PASO 4: dispute/resolve (${STATUS.toUpperCase()}) ===`);
  const token = await mintBearer();
  const resolveRes = await fetch('https://www.vence.es/api/v2/dispute/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ disputeId: DISPUTE_ID, questionType: 'legislative', status: STATUS, adminResponse: MENSAJE }) });
  const text = await resolveRes.text();
  console.log('Status:', resolveRes.status);
  const { data: vd } = await admin.from('question_disputes').select('status, admin_response').eq('id', DISPUTE_ID).single();
  console.log('Dispute:', { status: vd.status, resp_len: vd.admin_response?.length || 0 });
  let needFallback = false;
  if (resolveRes.status === 504 || !resolveRes.ok) needFallback = true;
  else { try { const j = JSON.parse(text); if (!j.success) needFallback = true; else console.log(`Endpoint OK — emailSent=${j.emailSent} skip=${j.emailSkipReason}`); } catch { needFallback = true; } }
  if (vd.status === STATUS && needFallback) {
    console.log('\n=== FALLBACK ===');
    const { data: p } = await admin.from('user_profiles').select('email').eq('id', UID).maybeSingle();
    await fallbackEmailBell(p?.email);
  } else if (vd.status !== STATUS) { console.error('FATAL'); process.exit(1); }
}
main().catch(e => { console.error('FATAL:', e); process.exit(1); });
