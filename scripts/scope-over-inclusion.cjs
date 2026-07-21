#!/usr/bin/env node
/**
 * Detector Stage-1 (DETERMINISTA) de SOBRE-INCLUSIÓN de topic_scope.
 *
 * Punto ciego que motiva esto (21/07, caso Luisa / Aux. Admvo. SMS T11):
 *   El epígrafe enumera sub-materias CONCRETAS de una ley (p.ej. "atención y
 *   asistencia; intimidad y confidencialidad; información y participación;
 *   deberes") pero el topic_scope mete la LEY ENTERA. Los detectores del
 *   health-sweep sólo cazan HUECOS (empty_topic, low_coverage,
 *   scope_titulo_huerfano, scope_phantom_article) → un scope con la ley
 *   completa sirve muchas preguntas y parece sano. Y el pipeline LLM
 *   verify:scope dio FALSO VERDE ("el epígrafe abarca toda la ley").
 *
 * Arquitectura del sistema (2 fases):
 *   Stage 1 (ESTE fichero, determinista): filtro barato de alta cobertura.
 *           5.836 scopes → ~decenas de sospechosos. NO decide corrección
 *           (eso exige mapear estructura), sólo SURFACEA candidatos y emite
 *           el hallazgo `scope_over_inclusion_suspect`.
 *   Stage 2 (LLM adjudicador, sobre los pocos candidatos): fuerza el mapeo
 *           epígrafe→título/capítulo y LISTA los títulos NO nombrados con
 *           preguntas scopeadas. Es el paso que le faltaba a verify:scope.
 *
 * Uso:
 *   node scripts/scope-over-inclusion.cjs --simulate   # casos sintéticos etiquetados (ground truth)
 *   node scripts/scope-over-inclusion.cjs --scan        # corre contra RDS (read-only)
 *   node scripts/scope-over-inclusion.cjs --scan --json # salida JSON para el sweep
 */

// ─────────────────────────────────────────────────────────────────────────────
// NÚCLEO PURO Y DETERMINISTA (testeable sin BD)
// ─────────────────────────────────────────────────────────────────────────────

const ROMAN = { I:1, V:5, X:10, L:50, C:100, D:500, M:1000 };
function romanToInt(s) {
  s = s.toUpperCase().replace(/\.BIS$/, '');
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN[s[i]], nxt = ROMAN[s[i + 1]];
    if (cur == null) return null;
    n += (nxt && cur < nxt) ? -cur : cur;
  }
  return n;
}

/** Extrae rasgos deterministas del epígrafe. */
function parseEpigrafe(ep) {
  ep = ep || '';
  const semis = (ep.match(/;/g) || []).length;
  const hasColon = /:/.test(ep);

  // Títulos nombrados explícitamente ("Título Preliminar", "Título IV", "Título II.bis")
  const titulos = [];
  const reTit = /[Tt][íi]tulo\s+(Preliminar|[IVXLC]+(?:\.bis)?)/g; // [Tt] literal: NO casar "capÍTULO"
  let m;
  while ((m = reTit.exec(ep)) !== null) {
    const tok = m[1];
    const val = /preliminar/i.test(tok) ? 0 : romanToInt(tok);
    if (val != null) titulos.push(val);
  }
  const titSet = [...new Set(titulos)].sort((a, b) => a - b);

  // ¿Los títulos nombrados forman secuencia COMPLETA 0..max sin huecos?
  let titComplete = null, titGap = false;
  if (titSet.length >= 2) {
    const max = titSet[titSet.length - 1];
    const full = [];
    for (let i = titSet[0]; i <= max; i++) full.push(i);
    // permitimos que arranque en Preliminar(0) o en I(1)
    const missing = full.filter(x => !titSet.includes(x));
    titGap = missing.length > 0;
    titComplete = !titGap;
  }
  const closureWord = /\breforma\b|disposici[oó]n(?:es)?\s+(?:adicional|transitoria|derogatoria|final)/i.test(ep);

  // Fuerza de enumeración: nº de segmentos tras el PRIMER colon, separados por
  // ";" O "," (captura enumeraciones con coma, no sólo punto y coma). Ej. SERMAS
  // enumera "principios rectores, medidas..., prevención...; derechos..." (1 ";").
  let segments = 0;
  if (hasColon) {
    const postColon = ep.slice(ep.indexOf(':') + 1);
    segments = postColon.split(/[;,]/)
      .map(s => s.trim())
      .filter(s => s.length >= 4 && /[a-záéíóúñ]/i.test(s)).length;
  }

  // Artículos citados EXPLÍCITAMENTE en el epígrafe ("arts. 45 a 49", "art. 51")
  const explicitArts = new Set();
  const reRange = /art[íi]?c?u?l?o?s?\.?\s*(\d+)\s*(?:a|al|-|–)\s*(\d+)/gi;
  while ((m = reRange.exec(ep)) !== null) {
    const a = +m[1], b = +m[2];
    if (b - a >= 0 && b - a < 500) for (let i = a; i <= b; i++) explicitArts.add(i);
  }
  const reSingle = /art[íi]?c?u?l?o?\.?\s*(\d+)(?!\s*(?:a|al|-|–)\s*\d)/gi;
  while ((m = reSingle.exec(ep)) !== null) explicitArts.add(+m[1]);

  const wholeLawWords = /[íi]ntegr|en su totalidad|toda la ley|texto [íi]ntegro|el conjunto de la ley|completa mente|la ley completa/i.test(ep);

  return { semis, hasColon, segments, titSet, titGap, titComplete, closureWord, explicitArts, wholeLawWords, len: ep.length };
}

/**
 * Clasifica un (topic, law) scope. Puro y determinista.
 * @returns {{suspect:boolean, band:'HIGH'|'MEDIUM'|'CLEARED'|'NONE', score:number, reasons:string[], coverage:number}}
 */
function classifyScope({ lawTotal, scopedCount, epigrafe }) {
  const reasons = [];
  const coverage = lawTotal > 0 ? scopedCount / lawTotal : 0;
  const f = parseEpigrafe(epigrafe);

  const bigLaw = lawTotal >= 12;
  const nearFull = coverage >= 0.9;
  // Enumerador: colon + >=3 segmentos (por ";" o ","). Cubre enumeraciones con
  // coma (SERMAS) además de las de punto y coma (T11).
  const enumerator = f.hasColon && f.segments >= 3;

  // Guardas negativas (limpian el candidato)
  if (f.wholeLawWords) {
    return { suspect: false, band: 'CLEARED', score: 0, coverage,
      reasons: ['epígrafe declara la ley íntegra → scope completo es correcto'] };
  }
  // Monográfico: epígrafe nombra títulos en secuencia COMPLETA + palabra de cierre
  if (f.titComplete && f.closureWord && nearFull) {
    return { suspect: false, band: 'CLEARED', score: 0, coverage,
      reasons: ['epígrafe enumera TODOS los títulos en secuencia + cierre (reforma/disposiciones) → ley completa legítima'] };
  }

  let score = 0;

  // Regla de ALTA confianza A: el epígrafe CITA artículos concretos y el scope tiene >>
  if (f.explicitArts.size > 0 && bigLaw && scopedCount >= f.explicitArts.size * 2 && nearFull) {
    score += 60;
    reasons.push(`epígrafe cita ${f.explicitArts.size} arts concretos pero scope tiene ${scopedCount}/${lawTotal}`);
  }
  // Regla de ALTA confianza B: epígrafe nombra títulos con HUECOS pero scope = ley entera
  if (f.titGap && nearFull && bigLaw) {
    score += 50;
    reasons.push(`epígrafe nombra títulos con huecos (${f.titSet.join(',')}) pero scope cubre toda la ley`);
  }
  // Regla MEDIA: ley grande + casi completa + epígrafe enumerador (patrón T11)
  if (bigLaw && nearFull && enumerator) {
    score += 30;
    reasons.push(`ley grande (${lawTotal}) casi completa (${(coverage * 100).toFixed(0)}%) con epígrafe que enumera ${f.segments} bloques`);
  }

  let band = 'NONE';
  if (score >= 50) band = 'HIGH';
  else if (score >= 30) band = 'MEDIUM';

  return { suspect: band !== 'NONE', band, score, coverage, reasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULACIÓN: casos sintéticos con ground-truth conocido
// ─────────────────────────────────────────────────────────────────────────────

const FIXTURES = [
  { name: 'T11 real (3 bloques subset, ley entera)', expect: true,
    lawTotal: 73, scopedCount: 73,
    epigrafe: 'Ley 3/2009: derechos relacionados con la atención y asistencia sanitaria; derechos en relación a la intimidad y a la confidencialidad; derechos en materia de información y participación sanitaria; deberes.' },

  { name: 'Estatuto monográfico (todos los títulos + reforma)', expect: false,
    lawTotal: 54, scopedCount: 54,
    epigrafe: 'El Estatuto de Autonomía: Título Preliminar; competencias (Título I); órganos institucionales (Título II); Administración de Justicia (Título III); Hacienda (Título IV); control (Título V); reforma' },

  { name: 'Ya estrechado correctamente (cobertura baja)', expect: false,
    lawTotal: 73, scopedCount: 23,
    epigrafe: 'Ley 3/2009: atención y asistencia; intimidad y confidencialidad; información y participación; deberes.' },

  { name: 'Ley pequeña scopeada entera (normal)', expect: false,
    lawTotal: 6, scopedCount: 6,
    epigrafe: 'Ley X: objeto; ámbito; principios.' },

  { name: 'Whole-law sin enumeración (no decidible → no marcar)', expect: false,
    lawTotal: 90, scopedCount: 90,
    epigrafe: 'La Ley 39/2015 del Procedimiento Administrativo Común.' },

  { name: 'Declara íntegra explícitamente', expect: false,
    lawTotal: 50, scopedCount: 50,
    epigrafe: 'Ley Y en su totalidad: disposiciones generales; procedimiento; régimen.' },

  { name: 'Título con hueco (nombra II y IV, salta III)', expect: true,
    lawTotal: 251, scopedCount: 251,
    epigrafe: 'Estatuto: Título Preliminar; Título I; Título II (salud); y Título IV (organización institucional).' },

  { name: 'Epígrafe cita arts. 45 a 49 y 51 pero scope 77', expect: true,
    lawTotal: 79, scopedCount: 77,
    epigrafe: 'LO 3/2007: objeto (Título Preliminar); tutela (Título I); los planes de igualdad (arts. 45 a 49); criterios de las AAPP (art. 51).' },

  { name: 'Frontera cobertura 0.9 ley mediana', expect: true,
    lawTotal: 20, scopedCount: 18,
    epigrafe: 'Ley Z: bloque uno; bloque dos; bloque tres.' },

  { name: 'Frontera cobertura 0.85 (por debajo)', expect: false,
    lawTotal: 20, scopedCount: 17,
    epigrafe: 'Ley Z: bloque uno; bloque dos; bloque tres.' },

  { name: 'SERMAS LO 1/2004 (enumeración por COMAS, ley entera)', expect: true,
    lawTotal: 73, scopedCount: 73,
    epigrafe: 'La LO 1/2004 contra la Violencia de Género: principios rectores, medidas de sensibilización, prevención y detección en el ámbito sanitario; derechos de las funcionarias públicas.' },

  { name: 'Generico con coma pero SIN colon (no marcar)', expect: false,
    lawTotal: 90, scopedCount: 90,
    epigrafe: 'La Ley 39/2015, del Procedimiento Administrativo Común de las Administraciones Públicas.' },
];

function runSimulation() {
  console.log('=== SIMULACIÓN (casos sintéticos etiquetados) ===\n');
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (const fx of FIXTURES) {
    const r = classifyScope(fx);
    const ok = r.suspect === fx.expect;
    if (r.suspect && fx.expect) tp++;
    else if (!r.suspect && !fx.expect) tn++;
    else if (r.suspect && !fx.expect) fp++;
    else fn++;
    const tag = ok ? '✅' : '❌ FALLO';
    console.log(`${tag}  esperado=${fx.expect ? 'SOSPECHOSO' : 'limpio   '}  →  ${r.suspect ? 'SOSPECHOSO' : 'limpio'} [${r.band}] score=${r.score}`);
    console.log(`     ${fx.name}`);
    if (r.reasons.length) console.log(`     motivo: ${r.reasons[0]}`);
    console.log('');
  }
  const total = FIXTURES.length, correct = tp + tn;
  console.log('─'.repeat(60));
  console.log(`Aciertos: ${correct}/${total}  |  TP=${tp} TN=${tn} FP=${fp} FN=${fn}`);
  const prec = tp + fp ? (tp / (tp + fp) * 100).toFixed(0) : 'n/a';
  const rec = tp + fn ? (tp / (tp + fn) * 100).toFixed(0) : 'n/a';
  console.log(`Precisión=${prec}%  Recall=${rec}%`);
  if (fn > 0) console.log('⚠️  Hay FALSOS NEGATIVOS: el detector se dejaría un caso real sin marcar.');
  process.exit(correct === total ? 0 : 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCAN: contra RDS (read-only)
// ─────────────────────────────────────────────────────────────────────────────

async function runScan(asJson) {
  require('dotenv').config({ path: '.env.local' });
  const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 });
  const rows = await sql`
    SELECT t.id topic_id, t.position_type, t.topic_number, t.title, t.epigrafe,
           l.short_name, ts.article_numbers,
           (SELECT count(*) FROM articles a WHERE a.law_id=ts.law_id AND a.article_number ~ '^[0-9]+$') law_total
    FROM topic_scope ts
    JOIN topics t ON t.id=ts.topic_id
    JOIN laws l ON l.id=ts.law_id
    WHERE t.is_active=true`;
  const hits = [];
  for (const r of rows) {
    const scopedCount = (r.article_numbers || []).filter(x => /^[0-9]+$/.test(x)).length;
    const c = classifyScope({ lawTotal: Number(r.law_total), scopedCount, epigrafe: r.epigrafe });
    if (c.suspect) hits.push({ ...r, ...c, scopedCount });
  }
  await sql.end();
  hits.sort((a, b) => b.score - a.score);
  if (asJson) { console.log(JSON.stringify(hits.map(h => ({
    kind: 'scope_over_inclusion_suspect', topic_id: h.topic_id, position_type: h.position_type,
    topic_number: h.topic_number, law: h.short_name, band: h.band, score: h.score,
    coverage: +(h.coverage).toFixed(2), reasons: h.reasons })), null, 2)); return; }
  console.log(`=== SCAN RDS: ${rows.length} scopes activos → ${hits.length} sospechosos ===\n`);
  for (const h of hits) {
    console.log(`[${h.band} ${h.score}] ${h.position_type} T${h.topic_number} | ${h.short_name} | ${(h.coverage * 100).toFixed(0)}% (${h.scopedCount}/${h.law_total})`);
    console.log(`   ${h.reasons[0]}`);
  }
  const byBand = {}; hits.forEach(h => byBand[h.band] = (byBand[h.band] || 0) + 1);
  console.log(`\nPor banda: ${Object.entries(byBand).map(([k, v]) => k + '=' + v).join('  ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--simulate')) runSimulation();
  else if (args.includes('--scan')) runScan(args.includes('--json')).catch(e => { console.error(e.message); process.exit(1); });
  else { console.log('Uso: --simulate | --scan [--json]'); process.exit(1); }
}

module.exports = { classifyScope, parseEpigrafe, romanToInt };
