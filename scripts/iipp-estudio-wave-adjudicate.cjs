// Adjudica doble pasada: cruza /tmp/iwave{W}_deep_*.json (verificación P1) con
// /tmp/iwave{W}_audit_*.json (auditoría ciega P2). Modifica los deep IN PLACE:
//  - P1 perfect + P2 confirm  -> se queda perfect (apply lo activará).
//  - P1 perfect + P2 dispute  -> downgrade a ambiguous_unresolvable (NO se activa, va a needs_human).
//  - P1 ya marcado defecto    -> se respeta P1 (no se toca).
// Tras esto, ejecutar wave-apply normal. Despacio pero fiable (manual: doble pasada).
const fs = require('fs');
const W = process.env.WAVE;
if (!W) { console.error('falta WAVE'); process.exit(1); }

let total = 0, kept = 0, downgraded = 0, p1flag = 0, noAudit = 0;
const downIds = [];
for (let n = 1; n <= 8; n++) {
  let deep, audit;
  try { deep = JSON.parse(fs.readFileSync(`/tmp/iwave${W}_deep_${n}.json`, 'utf8')); } catch (_) { continue; }
  try { audit = JSON.parse(fs.readFileSync(`/tmp/iwave${W}_audit_${n}.json`, 'utf8')); } catch (_) { audit = []; }
  const aud = Object.fromEntries(audit.map(a => [a.id, a]));
  for (const q of deep) {
    total++;
    if (q.root_cause === 'perfect') {
      const a = aud[q.id];
      if (!a) { noAudit++; q.root_cause = 'ambiguous_unresolvable'; q.new_explanation = null; q.reason = 'P2 sin auditoría (no cruzada) -> a revisión'; downgraded++; downIds.push(q.id.slice(0,8)+':noaudit'); continue; }
      if (a.audit_verdict === 'confirm') { kept++; }
      else { // dispute
        q.root_cause = 'ambiguous_unresolvable'; q.new_explanation = null;
        q.reason = 'P1 perfect pero P2 DISPUTA: ' + (a.reason || '').slice(0, 150);
        downgraded++; downIds.push(q.id.slice(0,8));
      }
    } else { p1flag++; }
  }
  fs.writeFileSync(`/tmp/iwave${W}_deep_${n}.json`, JSON.stringify(deep, null, 2));
}
console.log(`Ola ${W} adjudicada: total=${total} | perfect-confirmado=${kept} | downgrade(P2 dispute)=${downgraded} | ya-flag-P1=${p1flag} | sin-audit=${noAudit}`);
if (downIds.length) console.log('  downgraded:', downIds.join(' '));
