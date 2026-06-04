#!/usr/bin/env node
/**
 * audit-epigrafe-scope.cjs
 *
 * FASE AUTOMÁTICA de detección de incoherencias epígrafe ↔ topic_scope.
 * Nace de la auditoría manual `docs/maintenance/verificar-epigrafe-topic-scope.md`,
 * que cazaba estos fallos pero dependía de disciplina humana. Esto lo hace
 * mecánico y repetible (no chapuzas, robusto por construcción).
 *
 * Detecta:
 *   🔴 UNDER          — ley citada (con número) en el epígrafe pero ausente del scope
 *                       o presente a 0 artículos.
 *   🔴 WRONG_SUBJECT  — una ley del scope aporta >=80% de las preguntas servidas pero
 *                       su número NO aparece en el epígrafe (materia equivocada,
 *                       p.ej. Subvenciones sirviendo un tema de Presupuesto).
 *   🟡 EMPTY_ROW      — fila de topic_scope con article_numbers vacío (ruido / descuido).
 *   🟡 OVER           — ley del scope (con arts) cuyo número no está en el epígrafe
 *                       (señal débil; puede ser proxy legítimo de la estatal equivalente).
 *
 * Uso:
 *   node scripts/audit-epigrafe-scope.cjs                 # todas las oposiciones
 *   node scripts/audit-epigrafe-scope.cjs auxiliar_administrativo_clm auxiliar_administrativo_sms
 *
 * Exit code 1 si hay algún hallazgo 🔴 (apto como gate de CI).
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Extrae identificadores de norma con número del texto libre.
// Normaliza a forma canónica "N/AAAA" (ej. "39/2015", "2016/679", "3/2018").
function extractLawRefs(text) {
  if (!text) return new Set();
  const refs = new Set();
  // Ley / Ley Orgánica / LO / RD / Real Decreto / RDL / Real Decreto-ley / Decreto / Reglamento
  const re = /\b(?:ley\s+org[aá]nica|ley|l\.?o\.?|r\.?d\.?l\.?|real\s+decreto[\s-]?ley|real\s+decreto|r\.?d\.?|decreto|reglamento(?:\s*\(ue\))?)\s+(?:n[ºo.]?\s*)?(\d+\/\d{4})/gi;
  let m;
  while ((m = re.exec(text)) !== null) refs.add(m[1]);
  // Reglamentos UE con forma AAAA/NNN (RGPD 2016/679)
  const reUE = /\b(\d{4}\/\d{2,4})\b/g;
  while ((m = reUE.exec(text)) !== null) refs.add(m[1]);
  return refs;
}

const norm = (x) => (x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const STOP = new Set(['ley','organica','real','decreto','legislativo','reglamento','general','del','las','los','por','para','sobre','que','con','una','sus','este','esta','garantia','derechos','caracter','personal','publico','publica','publicos','servicios','servicio']);
// Acrónimos frecuentes en epígrafes → palabras de su nombre completo. Si el epígrafe usa el
// acrónimo, lo expandimos al comparar contra el nombre de la ley (ej. "EBEP" ↔ RDL 5/2015).
const ACRONYMS = {
  ebep: 'estatuto basico empleado', rgpd: 'reglamento proteccion datos', lgss: 'seguridad social',
  lgs: 'sanidad', lprl: 'prevencion riesgos laborales', ens: 'esquema nacional seguridad',
  trlpi: 'propiedad intelectual', tdah: '', lopdgdd: 'proteccion datos',
};

// ¿El epígrafe nombra esta ley DESCRIPTIVAMENTE? (ej. "Estatuto Básico del Empleado Público" ↔ RDL 5/2015)
// Heurística: tokens distintivos (≥4 letras, sin stopwords) del nombre de la ley que aparecen en
// el epígrafe. Referenciada si ≥2 coinciden, o si TODOS coinciden (nombres cortos: "Word 2019",
// "Windows 10", "La Red Internet" → leyes virtuales de informática).
function nameReferenced(lawName, shortName, epigrafe) {
  let epi = norm(epigrafe);
  for (const [acr, exp] of Object.entries(ACRONYMS)) {
    if (new RegExp(`\\b${acr}\\b`).test(epi) && exp) epi += ' ' + exp;
  }
  const test = (txt) => {
    const tokens = [...new Set(norm(txt).replace(/\d+\/\d+/g, ' ').split(/[^a-z]+/).filter(w => w.length >= 4 && !STOP.has(w)))];
    if (!tokens.length) return false;
    const hits = tokens.filter(w => epi.includes(w));
    return hits.length >= 2 || hits.length === tokens.length;
  };
  // Referenciada si la coincidencia salta por el nombre completo O por el short_name (la "marca").
  return test(lawName) || test(shortName);
}

async function auditPositionType(pt) {
  const { data: topics } = await s
    .from('topics')
    .select('id, topic_number, title, epigrafe')
    .eq('position_type', pt)
    .order('topic_number');
  if (!topics || !topics.length) return null;

  const findings = [];
  for (const t of topics) {
    if (!t.epigrafe) continue;
    const epiRefs = extractLawRefs(t.epigrafe);
    const { data: scope } = await s
      .from('topic_scope')
      .select('law_id, article_numbers')
      .eq('topic_id', t.id);

    const rows = [];
    let topicTotal = 0;
    for (const r of scope || []) {
      const { data: l } = await s.from('laws').select('short_name, name, slug').eq('id', r.law_id).single();
      const arts = r.article_numbers || [];
      let q = 0;
      if (arts.length) {
        const { data: as } = await s.from('articles').select('id').eq('law_id', r.law_id).in('article_number', arts);
        if (as && as.length) {
          const { count } = await s.from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true).in('primary_article_id', as.map(x => x.id));
          q = count || 0;
        }
      }
      // refs por número (short_name + name) + reconocimiento descriptivo por nombre
      const refs = new Set([...extractLawRefs(l ? l.short_name : ''), ...extractLawRefs(l ? l.name : '')]);
      const named = nameReferenced(l ? l.name : '', l ? l.short_name : '', t.epigrafe);
      rows.push({ name: l ? l.short_name : '?', arts: arts.length, q, refs, named });
      topicTotal += q;
    }

    const flags = [];
    const scopeRefs = new Set();
    rows.forEach(r => { if (r.arts > 0) r.refs.forEach(x => scopeRefs.add(x)); });

    // UNDER: ref del epígrafe sin cobertura en scope (por número)
    for (const ref of epiRefs) {
      if (!scopeRefs.has(ref)) flags.push(`🔴 UNDER: epígrafe cita ${ref} pero no está en scope (o a 0 arts)`);
    }
    // EMPTY_ROW
    rows.filter(r => r.arts === 0).forEach(r => flags.push(`🟡 EMPTY_ROW: ${r.name} a 0 arts`));
    // WRONG_SUBJECT + OVER — una ley está "referenciada" si su número está en el epígrafe O su nombre lo está
    for (const r of rows) {
      if (r.arts === 0 || r.q === 0) continue;
      const referenced = [...r.refs].some(x => epiRefs.has(x)) || r.named;
      if (referenced) continue;
      const share = topicTotal ? r.q / topicTotal : 0;
      if (share >= 0.8) flags.push(`🔴 WRONG_SUBJECT: ${r.name} aporta ${(share*100).toFixed(0)}% (${r.q}q) pero ni su número ni su nombre están en el epígrafe`);
      else flags.push(`🟡 OVER: ${r.name} (${r.q}q) en scope pero no referenciada en epígrafe`);
    }
    // LOW_COVERAGE: tema con muy pocas preguntas servidas
    if (topicTotal > 0 && topicTotal < 10) flags.push(`🟡 LOW_COVERAGE: solo ${topicTotal}q servidas`);

    if (flags.length) findings.push({ t: t.topic_number, title: t.title, total: topicTotal, flags, rows });
  }
  return findings;
}

(async () => {
  let targets = process.argv.slice(2);
  if (!targets.length) {
    const { data } = await s.from('topics').select('position_type');
    targets = [...new Set((data || []).map(x => x.position_type).filter(Boolean))];
  }
  let red = 0, yellow = 0;
  for (const pt of targets.sort()) {
    const findings = await auditPositionType(pt);
    if (findings === null) continue;
    if (!findings.length) { console.log(`✅ ${pt}: sin incidencias`); continue; }
    console.log(`\n━━━ ${pt} ━━━`);
    for (const f of findings) {
      console.log(`  T${f.t} (${f.total}q) — ${f.title.slice(0, 60)}`);
      f.flags.forEach(fl => { console.log('      ' + fl); fl.startsWith('🔴') ? red++ : yellow++; });
    }
  }
  console.log(`\n=== ${red} 🔴  /  ${yellow} 🟡 ===`);
  process.exit(red > 0 ? 1 : 0);
})();
