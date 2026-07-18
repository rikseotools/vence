#!/usr/bin/env node
// Detector DETERMINISTA de mislink por ley (causa raíz: vincular por nº de artículo sin cruzar law_id).
// Complementa a barrido-citas.cjs: aquel solo cazaba mislinks con CITA entrecomillada; éste mira la
// LEY que la explicación NOMBRA (por su número N/AAAA o su código: CE, CP, TREBEP…) y la compara con la
// ley VINCULADA. Si la explicación invoca leyes y NINGUNA es la vinculada → candidato a mislink, tenga cita o no.
//
// Es un CRIBADO barato (mide el tamaño del problema), NO un veredicto: cada candidato se verifica luego
// con el pipeline v2.1 (verify → auditoría ciega → adjudicar). NUNCA auto-aplicar ni auto-flip de clave.
//
// Uso: node scripts/impugnaciones/barrido-mislink-ley.cjs [--out f.json]
const fs = require('fs');
const path = require('path');
// postgres.js: deps raíz; backend/node_modules como respaldo (scripts CLI, no corren en CI)
const pg = (() => { try { return require('postgres'); } catch { return require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres')); } })();

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}

// Código canónico ← detectado por CUALQUIER alias: sigla, nombre oficial (fragmento distintivo) o su N/AAAA.
// Se aplica IGUAL a la explicación y a la ley vinculada, para que "LO 6/1985" y "LOPJ" colapsen al mismo código
// (si no, un art. de la LOPJ cuya explicación dice "LOPJ" saldría como falso mislink).
const CODIGOS = {
  CE:     /\b(CE)\b|Constituci[óo]n Espa[ñn]ola|Constituci[óo]n de 1978/i,
  CP:     /\bCP\b|C[óo]digo Penal|\b10\/1995\b/i,
  TREBEP: /\b(TREBEP|EBEP)\b|Estatuto B[áa]sico del Empleado|\b5\/2015\b/i,
  TFUE:   /\bTFUE\b|Funcionamiento de la Uni[óo]n Europea/i,
  TUE:    /\bTUE\b|Tratado de la Uni[óo]n Europea/i,
  LEC:    /\bLEC\b|Enjuiciamiento Civil|\b1\/2000\b/i,
  LECrim: /\bLECrim\b|Enjuiciamiento Criminal/i,
  LOPJ:   /\bLOPJ\b|Poder Judicial|\b6\/1985\b/i,
  LOTC:   /\bLOTC\b|Tribunal Constitucional|\b2\/1979\b/i,
  LBRL:   /\bLBRL\b|Bases del R[ée]gimen Local|\b7\/1985\b/i,
};

// N/AAAA que aparecen en un texto: "39/2015", "10/1995"…
const numsDe = (t) => new Set((t.match(/\b\d{1,3}\/\d{4}\b/g) || []));
// códigos nombrados en un texto (por cualquier alias)
const codsDe = (t) => Object.entries(CODIGOS).filter(([, re]) => re.test(t)).map(([k]) => k);

// firma de la ley vinculada: su N/AAAA + su(s) código(s), detectados de short_name + name completos
function firmaLey(shortName, name) {
  const blob = `${shortName || ''} ${name || ''}`;
  return { nums: numsDe(blob), cods: new Set(codsDe(blob)) };
}

// Identidad canónica de una referencia legal (código o N/AAAA), para comparar "misma ley" sin depender del alias.
function idLey(ref) {
  const cods = codsDe(ref);
  if (cods.length) return cods[0]; // colapsa CE/CP/LOPJ… a su código
  const n = ref.match(/\b\d{1,3}\/\d{4}\b/);
  return n ? n[0] : null;
}

// FIRMA DE ALTA PRECISIÓN (causa raíz pura): la explicación atribuye el MISMO nº de artículo que el vinculado
// a OTRA ley. Ej.: vinculado LECrim art 6, explicación dice "art. 6 CP" → colisión de número, ley distinta.
// Extrae pares (nº art, ley) de patrones "art N <ley>" y "<ley> art N" y busca uno con N==linkedArt, ley≠linked.
function colisionMismoNumeroOtraLey(exp, linkedArtNum, firmaLinked) {
  const linkedIds = new Set([...firmaLinked.nums, ...firmaLinked.cods]);
  const artN = String(linkedArtNum).match(/\d+/)?.[0];
  if (!artN) return null;
  // "art(ículo) N [.,)] ... <refLey>" en una ventana corta tras el número
  const reArtLey = new RegExp(`art[íi]?c?u?l?o?\\.?\\s*${artN}\\b[^\\n.]{0,45}?(\\b\\d{1,3}\\/\\d{4}\\b|\\bCE\\b|\\bCP\\b|\\bLOPJ\\b|\\bLOTC\\b|\\bLEC\\b|\\bLECrim\\b|\\bTREBEP\\b|\\bLBRL\\b|\\bTFUE\\b|\\bTUE\\b)`, 'gi');
  // "<refLey> ... art(ículo) N" (ley antes del número)
  const reLeyArt = new RegExp(`(\\b\\d{1,3}\\/\\d{4}\\b|\\bCE\\b|\\bCP\\b|\\bLOPJ\\b|\\bLOTC\\b|\\bLEC\\b|\\bLECrim\\b|\\bTREBEP\\b|\\bLBRL\\b|\\bTFUE\\b|\\bTUE\\b)[^\\n.]{0,25}?art[íi]?c?u?l?o?\\.?\\s*${artN}\\b`, 'gi');
  for (const re of [reArtLey, reLeyArt]) {
    let m;
    while ((m = re.exec(exp)) !== null) {
      const refId = idLey(m[1]);
      if (refId && !linkedIds.has(refId)) return { articulo: artN, otraLey: refId, fragmento: m[0].slice(0, 60) };
    }
  }
  return null;
}

(async () => {
  const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
  const precision = process.argv.includes('--precision');
  const sql = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const filas = await sql`
      SELECT q.id, q.explanation, l.short_name, l.name AS law_name, a.article_number,
             (SELECT count(*)::int FROM test_questions tq WHERE tq.question_id = q.id) AS intentos
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
      WHERE q.lifecycle_state IN ('approved','tech_approved') AND q.explanation IS NOT NULL`;
    console.log(`preguntas visibles con explicación: ${filas.length}`);

    let conMencion = 0;
    const candidatos = [];
    for (const r of filas) {
      const exp = r.explanation;
      const numsExp = numsDe(exp);
      const codsExp = new Set(codsDe(exp));
      if (numsExp.size === 0 && codsExp.size === 0) continue; // la explicación no nombra ninguna ley identificable
      conMencion++;
      const firma = firmaLey(r.short_name, r.law_name);
      // ¿alguna ley nombrada COINCIDE con la vinculada?
      const numOk = [...numsExp].some((n) => firma.nums.has(n));
      const codOk = [...codsExp].some((cod) => firma.cods.has(cod));
      // sospecha SOLO si la explicación nombra ley(es) y NINGUNA es la vinculada,
      // y la vinculada tiene firma identificable (si no, no podemos comparar → no acusar)
      const firmaIdentificable = firma.nums.size > 0 || firma.cods.size > 0;
      if (firmaIdentificable && !numOk && !codOk) {
        // filtro de ALTA PRECISIÓN opcional: exigir colisión mismo-nº-otra-ley (firma pura de la causa raíz)
        const colision = colisionMismoNumeroOtraLey(exp, r.article_number, firma);
        if (precision && !colision) continue;
        candidatos.push({
          question_id: r.id, vinculada: `${r.short_name} art ${r.article_number}`,
          nombra: [...numsExp, ...codsExp].join(','), intentos: r.intentos,
          colision: colision ? `art ${colision.articulo}→${colision.otraLey}` : null,
        });
      }
    }
    candidatos.sort((a, b) => b.intentos - a.intentos);
    console.log(`explicaciones que nombran ≥1 ley identificable: ${conMencion}`);
    console.log(`CANDIDATOS${precision ? ' (ALTA PRECISIÓN: colisión mismo nº art, otra ley)' : ' (nombran ley ≠ la vinculada)'}: ${candidatos.length} (${(100 * candidatos.length / conMencion).toFixed(1)}% de las que nombran ley)`);
    console.log(`  ya vistos por usuarios (intentos>0): ${candidatos.filter((c) => c.intentos > 0).length}`);
    console.log('\n─── Top 30 por tráfico ───');
    console.table(candidatos.slice(0, 30).map((c) => ({
      qid: c.question_id.slice(0, 8), vinculada: c.vinculada, nombra: c.nombra,
      colision: c.colision || '', intentos: c.intentos,
    })));
    if (out) { fs.writeFileSync(out, JSON.stringify(candidatos, null, 1)); console.log(`\nvolcado (${candidatos.length}) → ${out}`); }
    console.log('\nCRIBADO, no veredicto: cada candidato va al pipeline v2.1 (verify→audita→adjudica). NUNCA auto-flip.');
  } finally { await sql.end(); }
})();
