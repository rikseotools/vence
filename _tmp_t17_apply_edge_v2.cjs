require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Keys = prefijo (12 chars) → ACCIÓN
const ACTIONS = {
  // Wrong answer - nuevo correct_option (A=0,B=1,C=2,D=3)
  '2986e9c0': { action: 'wrong_answer_fix', new_correct: 2 }, // C
  '647cebca': { action: 'wrong_answer_fix', new_correct: 1 }, // B
  '713fb605': { action: 'wrong_answer_fix', new_correct: 1 }, // B
  'b8c05609': { action: 'wrong_answer_fix', new_correct: 1 }, // B
  'f8bd07d3': { action: 'wrong_answer_fix', new_correct: 1 }, // B
  'f94eccc9': { action: 'wrong_answer_fix', new_correct: 2 }, // C
  // Borderline - activate as-is
  'ba9b5c6f': { action: 'activate' },
  // wrong_article OK
  '434d7abf': { action: 'activate' },
  // Outlook out_of_scope false positives - activate
  '51122c80': { action: 'activate' },
  '5d059473': { action: 'activate' },
  '6051cbd6': { action: 'activate' },
  '65483fa0': { action: 'activate' },
  '68ba343d': { action: 'activate' },
  '6c33f572': { action: 'activate' },
  '73aec083': { action: 'activate' },
  'a293d00a': { action: 'activate' },
  // Truly out of scope (Internet, ARPANET, CERN, puertos, LMS, imagen faltante, navegador)
  '00b50adc': { action: 'deactivate', reason: 'Fuera del ámbito T17: historia de Internet / ARPANET (corresponde a T15 Redes)', status: 'out_of_scope' },
  '0b530ab8': { action: 'deactivate', reason: 'Fuera del ámbito T17: concepto de Internet (corresponde a T15 Redes)', status: 'out_of_scope' },
  '0fa16a2f': { action: 'deactivate', reason: 'Fuera del ámbito T17: modelo OSI / protocolos de red', status: 'out_of_scope' },
  '22df74e3': { action: 'deactivate', reason: 'Fuera del ámbito T17: ARPANET e historia de Internet', status: 'out_of_scope' },
  '2b84902f': { action: 'deactivate', reason: 'Fuera del ámbito T17: ARPANET e historia de Internet', status: 'out_of_scope' },
  '39abf0ea': { action: 'deactivate', reason: 'Fuera del ámbito T17: CERN y desarrollo de la Web', status: 'out_of_scope' },
  '359b8e0a': { action: 'deactivate', reason: 'Fuera del ámbito T17: marcadores de navegador web', status: 'out_of_scope' },
  'a45be843': { action: 'deactivate', reason: 'Pregunta depende de imagen no disponible (icono de Calc)', status: 'unverifiable' },
  'ce026a93': { action: 'deactivate', reason: 'Fuera del ámbito T17: plataformas e-learning/LMS', status: 'out_of_scope' },
  'eba08455': { action: 'deactivate', reason: 'Fuera del ámbito T17: puertos TCP/UDP P2P', status: 'out_of_scope' },
  'f9c5a8a7': { action: 'deactivate', reason: 'Pregunta depende de imagen no disponible (#VALOR! en Calc)', status: 'unverifiable' },
  // Outdated
  '2ae31ae2': { action: 'deactivate', reason: 'Pregunta obsoleta: referencia a OpenOffice 5.1 (versión inexistente)', status: 'outdated' },
  '2f5045f0': { action: 'deactivate', reason: 'Pregunta obsoleta: comportamiento histórico de Gmail (almacenamiento que aumenta día a día)', status: 'outdated' },
  '649e2a19': { action: 'deactivate', reason: 'Pregunta obsoleta: redactada para OpenOffice Calc antiguo', status: 'outdated' },
  '7995ac68': { action: 'deactivate', reason: 'Pregunta obsoleta: opción "Intermitente" eliminada de Writer en versiones modernas', status: 'outdated' },
  // No valid answer
  '6536ba74': { action: 'deactivate', reason: 'Ninguna opción es técnicamente correcta: todas las fórmulas SUMA tienen errores de sintaxis', status: 'discarded' },
};

(async () => {
  const cons = JSON.parse(fs.readFileSync('t17_galicia_consolidated.json'));
  const now = new Date().toISOString();

  // Build full ID map
  const pendingStatuses = new Set(['wrong_answer','wrong_article','out_of_scope','outdated']);
  const pendings = cons.filter(r => pendingStatuses.has(r.status));
  console.log('Pending statuses a procesar:', pendings.length);

  // Pre-fetch explanation_fix for each (many out_of_scope Outlook have explanation_fix)
  const ids = pendings.map(r => r.id);
  const { data: avrs } = await s.from('ai_verification_results').select('question_id, explanation_fix').in('question_id', ids).eq('ai_provider', 'claude_code');
  const expMap = new Map();
  for (const a of avrs) if (a.explanation_fix && !expMap.has(a.question_id)) expMap.set(a.question_id, a.explanation_fix);

  let applied = 0, skipped = 0;
  for (const r of pendings) {
    const prefix = r.id.slice(0, 8);
    const action = ACTIONS[prefix];
    if (!action) { console.log('  ⚠️  sin acción:', r.id, '(' + r.status + ')'); skipped++; continue; }

    if (action.action === 'activate') {
      const upd = {
        topic_review_status: 'perfect',
        verification_status: 'ok',
        verified_at: now,
        is_active: true,
        deactivation_reason: null,
      };
      const exp = expMap.get(r.id);
      if (exp) upd.explanation = exp;
      const { error } = await s.from('questions').update(upd).eq('id', r.id);
      if (error) { console.error('  ❌ activate', r.id, error.message); continue; }
      applied++;
      console.log('  ✅ activate', prefix);
    } else if (action.action === 'wrong_answer_fix') {
      const upd = {
        correct_option: action.new_correct,
        topic_review_status: 'perfect',
        verification_status: 'ok',
        verified_at: now,
        is_active: true,
        deactivation_reason: null,
      };
      const exp = expMap.get(r.id);
      if (exp) upd.explanation = exp;
      const { error } = await s.from('questions').update(upd).eq('id', r.id);
      if (error) { console.error('  ❌ wa_fix', r.id, error.message); continue; }
      applied++;
      console.log('  ✅ wa_fix', prefix, '→', ['A','B','C','D'][action.new_correct]);
    } else if (action.action === 'deactivate') {
      const { error } = await s.from('questions').update({
        topic_review_status: action.status,
        verification_status: 'fail',
        verified_at: now,
        is_active: false,
        deactivation_reason: action.reason,
      }).eq('id', r.id);
      if (error) { console.error('  ❌ deact', r.id, error.message); continue; }
      applied++;
      console.log('  ⚠️  deact', prefix, '|', action.status);
    }
  }
  console.log('\nAplicados:', applied, '| Skipped:', skipped);

  // Final state
  const iids = JSON.parse(fs.readFileSync('t17_galicia_imported_ids.json'));
  const { data: final } = await s.from('questions').select('is_active, topic_review_status').in('id', iids);
  const active = final.filter(q => q.is_active).length;
  const byStatus = {};
  for (const q of final) byStatus[q.topic_review_status] = (byStatus[q.topic_review_status] || 0) + 1;
  console.log('\nEstado final T17:');
  console.log('  Total:', iids.length, '| Activas:', active);
  console.log('  Por status:', byStatus);
})();
