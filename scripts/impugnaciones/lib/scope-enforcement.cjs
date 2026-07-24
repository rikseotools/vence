// scripts/impugnaciones/lib/scope-enforcement.cjs
//
// ENFORCEMENT de la "Regla previa OBLIGATORIA" de docs/runbooks/verificar-epigrafes-scope.md:
// siempre que un usuario (impugnación O feedback) hable de TEMARIO / epígrafe / scope / "no
// entra" / "es de otro tema", la BD de SU oposición debe estar en orden ANTES de resolver
// (Paso 1: epígrafe clonado del oficial → Paso 2: scope↔epígrafe). El código lo comprueba para
// que NO se salte por depender de la memoria de Claude — misma filosofía que el push-guard del
// backlog y las herramientas obligatorias de la cola.
//
// Motivo (caso 24/07, Sara García): se estuvo a punto de rechazar una impugnación de scope como
// "falso positivo" SIN Paso 1. La oposición tenía el scope "verified_correct" (Paso 2) pero el
// epígrafe `never_sourced` (Paso 1 saltado) → el scope se había verificado contra una referencia
// sin validar = FALSO VERDE. Usado por revisar-impugnacion.cjs y revisar-feedback.cjs.

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Frases que delatan una queja de temario/epígrafe/scope (sobre `norm(text)`, sin acentos).
const SCOPE_TRIGGER = /\b(temario|tema|epigrafe|scope|no entra|no aparece|no esta|no figura|falta|fuera del temario|otro tema|otro bloque|no corresponde|deberia entrar|primera parte|1a parte|segunda parte|entra en el|deberia estar|no deberia)\b/i;

/**
 * @param s          cliente postgres
 * @param text       texto del usuario (descripción de la impugnación o mensajes del feedback)
 * @param oposicion  position_type del usuario (target_oposicion)
 * @param force      forzar el disparo (p.ej. dispute_type==='tema_incorrecto')
 * @returns string   bloque de aviso para imprimir (vacío si no aplica)
 */
async function scopeEnforcement(s, { text, oposicion, force }) {
  const triggered = !!force || SCOPE_TRIGGER.test(norm(text));
  if (!triggered) return '';
  if (!oposicion) {
    return '\n─── ⚠️ CHECK SCOPE/EPÍGRAFE (§Regla previa OBLIGATORIA — la queja va de temario) ───\n'
      + '   ⚠️ El usuario NO tiene target_oposicion → identifica la oposición a mano y comprueba su verificación\n'
      + '      (Paso 1 epígrafe + Paso 2 scope) antes de resolver — verificar-epigrafes-scope.md.';
  }
  const epi = await s.unsafe(
    `SELECT COALESCE(ev.state,'never_sourced') st, count(*)::int n
     FROM topics t LEFT JOIN topic_epigrafe_verification ev ON ev.topic_id=t.id
     WHERE t.position_type=$1 AND t.is_active GROUP BY 1 ORDER BY 2 DESC`, [oposicion]);
  const sco = await s.unsafe(
    `SELECT COALESCE(sv.state,'never_verified') st, count(*)::int n
     FROM topics t LEFT JOIN topic_scope_verification sv ON sv.topic_id=t.id
     WHERE t.position_type=$1 AND t.is_active GROUP BY 1 ORDER BY 2 DESC`, [oposicion]);
  const neverSourced = epi.find((r) => r.st === 'never_sourced')?.n || 0;
  const scopeOpen = sco.filter((r) => ['verified_issues', 'never_verified', 'stale'].includes(r.st)).reduce((a, r) => a + r.n, 0);
  const fmt = (rows) => rows.map((r) => `${r.st}=${r.n}`).join(', ') || '(sin datos)';
  let out = '\n─── ⚠️ CHECK SCOPE/EPÍGRAFE (§Regla previa OBLIGATORIA — la queja va de temario) ───\n';
  out += `   Oposición del usuario: ${oposicion}\n`;
  out += `   Paso 1 (epígrafe oficial clonado): ${fmt(epi)}\n`;
  out += `   Paso 2 (scope↔epígrafe):           ${fmt(sco)}\n`;
  if (neverSourced > 0) {
    out += `   🛑 PASO 1 SIN HACER (${neverSourced} temas never_sourced). NO resuelvas aún: clona el epígrafe LITERAL del\n`
      + `      programa_url de la convocatoria a topics.epigrafe y verifica (verify-epigrafe-literality.cjs), LUEGO re-\n`
      + `      verifica el scope. Resolver ahora = comprobar el scope contra una referencia sin validar (falso verde).`;
  } else if (scopeOpen > 0) {
    out += `   ⚠️ El epígrafe está clonado, pero el SCOPE tiene ${scopeOpen} temas sin cerrar (issues/never_verified/stale)\n`
      + `      → revisa el tema implicado contra su epígrafe antes de resolver.`;
  } else {
    out += '   🟢 Paso 1 y Paso 2 en orden para esta oposición → puedes analizar la queja sobre base firme.';
  }
  return out;
}

// ¿el texto del usuario es una queja de temario/epígrafe/scope? (parte pura, testeable)
const isScopeComplaint = (text) => SCOPE_TRIGGER.test(norm(text));

module.exports = { norm, SCOPE_TRIGGER, scopeEnforcement, isScopeComplaint };
