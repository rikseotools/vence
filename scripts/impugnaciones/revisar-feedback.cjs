#!/usr/bin/env node
// Dossier estructurado de un FEEDBACK (manual gestionar-feedback-bug.md, Paso 0 + Paso 3).
// GEMELO de revisar-impugnacion.cjs, pero para la cola de feedback.
//
// POR QUÉ EXISTE (incidente 21/07): al analizar un feedback a mano, es fácil leer solo el
// PRIMER mensaje y NO ver que el usuario ya respondió (o que ya se le contestó) → se
// re-envía una respuesta y se DUPLICA el mensaje al usuario (le pasó a Lú). La causa raíz:
// consultar `feedback_messages` con una columna que no existe (`feedback_id`) y tragarse el
// error con un `.catch(()=>[])` → falso "sin mensajes". Este script CIERRA ese hueco:
// vuelca SIEMPRE la CONVERSACIÓN ENTERA (por `conversation_id`, el link fiable) + un
// veredicto de Paso 0 explícito. Si una query peta, PETA (no se traga el error).
//
// Uso: node scripts/impugnaciones/revisar-feedback.cjs <feedback_id> [--sid <id-sesión>]
//   Con --sid: COGE (claim) el feedback (user_feedback.claimed_by), avisa si otra sesión lo
//   tiene fresco (<2h). Sin --sid: solo dossier.

const fs = require('fs');
const pg = require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres');

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(require('path').join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}

const ago = (d) => {
  if (!d) return '-';
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 60 ? m + 'm' : m < 1440 ? (m / 60).toFixed(1) + 'h' : (m / 1440).toFixed(1) + 'd';
};

(async () => {
  const fid = process.argv[2];
  if (!fid) { console.error('Uso: revisar-feedback.cjs <feedback_id> [--sid <id>]'); process.exit(2); }
  const s = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const [fb] = await s`SELECT * FROM user_feedback WHERE id=${fid}`;
    if (!fb) { console.error('Feedback no encontrado:', fid); process.exit(2); }

    // --- CLAIM (reparto entre sesiones). Solo con --sid. No fatal. ---
    let claimWarn = '';
    const sidIdx = process.argv.indexOf('--sid');
    const sid = (sidIdx >= 0 ? process.argv[sidIdx + 1] : null) || process.env.CLAUDE_CODE_SESSION_ID || null;
    if (sid && fb.status === 'pending') {
      const fresh = fb.claimed_by && fb.claimed_by !== sid && fb.claimed_at && (Date.now() - new Date(fb.claimed_at).getTime()) < 2 * 3600e3;
      if (fresh) {
        claimWarn = `⚠️  YA LO ESTÁ REVISANDO otra sesión (${String(fb.claimed_by).slice(0, 8)}, hace ${ago(fb.claimed_at)}). No lo trabajes.`;
      } else {
        await s`UPDATE user_feedback SET claimed_by=${sid}, claimed_at=now() WHERE id=${fid}`;
        claimWarn = `🔒 Cogido por tu sesión (${String(sid).slice(0, 8)}).`;
      }
    }

    console.log('═'.repeat(70));
    console.log(`DOSSIER FEEDBACK ${String(fb.id).slice(0, 8)}  [${fb.type}]`);
    console.log('═'.repeat(70));
    if (claimWarn) console.log(claimWarn);

    // --- Usuario ---
    const [p] = await s`SELECT full_name, email, plan_type, target_oposicion, ciudad, created_at FROM user_profiles WHERE id=${fb.user_id}`;
    console.log(`Usuario: ${p ? p.full_name : '(contacto externo)'}${p ? ` (${p.email})` : ''}`);
    if (p) console.log(`  plan: ${p.plan_type} | oposición: ${p.target_oposicion} | ciudad: ${p.ciudad || '?'} | alta hace ${ago(p.created_at)}`);
    console.log(`Estado: ${fb.status} | creado hace ${ago(fb.created_at)}${fb.question_id ? ` | question_id: ${String(fb.question_id).slice(0, 8)}` : ''}`);

    // --- Mensaje original del feedback ---
    console.log('\nMensaje original del feedback:');
    console.log('  ' + (fb.message || '(vacío)').replace(/\n/g, '\n  '));

    // --- PASO 0: LA CONVERSACIÓN ENTERA (link fiable = conversation_id) ---
    // NO se filtra por `feedback_id` (esa columna NO existe en feedback_messages).
    const convs = await s`SELECT id, status, last_message_at FROM feedback_conversations WHERE feedback_id=${fb.id} ORDER BY created_at`;
    console.log('\n─── PASO 0: CONVERSACIÓN COMPLETA (¿ya respondido? ¿el usuario contestó?) ───');
    let allMsgs = [];
    if (!convs.length) {
      console.log('  (sin conversación en feedback_conversations)');
    }
    for (const c of convs) {
      const msgs = await s`SELECT is_admin, message, created_at FROM feedback_messages WHERE conversation_id=${c.id} ORDER BY created_at`;
      allMsgs = allMsgs.concat(msgs);
      console.log(`  conversación ${String(c.id).slice(0, 8)} (status=${c.status}) — ${msgs.length} mensaje(s):`);
      msgs.forEach((m) => console.log(`    [${ago(m.created_at)}] ${m.is_admin ? 'ADMIN' : 'USER '}: ${(m.message || '').replace(/\n/g, ' ').slice(0, 200)}`));
    }
    // admin_response legacy (a veces la respuesta se quedó SOLO aquí y no llegó al hilo)
    if (fb.admin_response) {
      const inThread = allMsgs.some((m) => m.is_admin && (m.message || '').trim().slice(0, 40) === (fb.admin_response || '').trim().slice(0, 40));
      console.log(`\n  admin_response (legacy): PRESENTE${inThread ? ' (y también en el hilo ✓)' : ' ⚠️ pero NO está en el hilo (¿entrega fallida?)'}`);
    }

    // --- VEREDICTO Paso 0 (mecánico; el juicio lo pone Claude) ---
    const adminN = allMsgs.filter((m) => m.is_admin).length;
    const userN = allMsgs.filter((m) => !m.is_admin).length;
    const last = allMsgs[allMsgs.length - 1];
    // duplicado = 2+ admin seguidos sin user en medio
    let dupWarn = false;
    for (let i = 1; i < allMsgs.length; i++) if (allMsgs[i].is_admin && allMsgs[i - 1].is_admin) dupWarn = true;
    console.log('\n  ▶ VEREDICTO:');
    console.log(`    mensajes: ${adminN} ADMIN, ${userN} USER`);
    if (!allMsgs.length && !fb.admin_response) {
      console.log('    → SIN RESPONDER. Redacta borrador (con OK antes de enviar).');
    } else if (last && !last.is_admin && adminN > 0) {
      console.log(`    → ⚠️ EL ÚLTIMO MENSAJE ES DEL USUARIO (hace ${ago(last.created_at)}) tras haberle respondido.`);
      console.log('       Ya se le contestó y ha RE-ESCRITO: NO re-envíes lo anterior. Responde a su ÚLTIMO mensaje.');
    } else if (last && !last.is_admin) {
      console.log('    → Último mensaje del usuario, sin respuesta admin aún. Redacta borrador.');
    } else if (last && last.is_admin) {
      console.log(`    → YA RESPONDIDO (último mensaje ADMIN hace ${ago(last.created_at)}).`);
      console.log('       Si el usuario no ha vuelto a escribir → NO envíes otra respuesta; cierra silencioso (finalStatus:resolved sin message).');
    } else if (fb.admin_response && !allMsgs.length) {
      console.log('    → Respuesta SOLO en admin_response (legacy), NO en el hilo → entrega fallida real: re-entregar vía /api/v2/feedback/respond.');
    }
    if (dupWarn) console.log('    → 🔴 POSIBLE DUPLICADO YA EN EL HILO (2+ ADMIN seguidos). Revisar antes de tocar nada.');

    // --- Paso 3: journey ---
    console.log('\n─── Paso 3: JOURNEY (últimas interacciones) ───');
    const j = await s`SELECT event_type, page_url, element_text, created_at FROM user_interactions WHERE user_id=${fb.user_id} ORDER BY created_at DESC LIMIT 12`;
    j.reverse().forEach((x) => console.log(`  ${ago(x.created_at).padStart(6)} ${x.event_type}${x.page_url ? ' ' + x.page_url.replace('https://www.vence.es', '') : ''}${x.element_text ? ' «' + x.element_text.slice(0, 28) + '»' : ''}`));

    // --- Historial de feedbacks + impugnaciones del usuario ---
    const hist = await s`SELECT type, status, left(message, 45) m, created_at FROM user_feedback WHERE user_id=${fb.user_id} ORDER BY created_at DESC`;
    console.log('\nHistorial feedbacks:', hist.map((h) => `[${h.status} ${ago(h.created_at)}] ${h.m}`).join(' | '));
    const disp = await s`SELECT dispute_type, status, created_at FROM question_disputes WHERE user_id=${fb.user_id} ORDER BY created_at DESC LIMIT 5`;
    console.log('Impugnaciones:', disp.length ? disp.map((d) => `${d.dispute_type}/${d.status}`).join(' | ') : 'ninguna');

    console.log('\n─── CHECKLIST antes de responder ───');
    console.log('  [ ] 1. He LEÍDO la conversación entera (arriba), no solo el 1er mensaje.');
    console.log('  [ ] 2. Si el último mensaje es del USUARIO, respondo a ESE (no re-envío lo anterior).');
    console.log('  [ ] 3. Journey/historial mirados (la intención real ≠ texto literal).');
    console.log('  [ ] 4. Borrador con OK de Manuel ANTES de enviar (nunca envío directo).');
    console.log('  [ ] 5. Cierro vía /api/v2/feedback/respond (message = responder; sin message = cierre silencioso).');
  } finally {
    await s.end();
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
