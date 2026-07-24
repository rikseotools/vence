// lib/laws/scopeTitleBoundary.js
//
// Detecta el OFF-BY-ONE DE FRONTERA DE TÍTULO en topic_scope: un artículo
// escopado que pertenece a un título que el epígrafe NO nombra.
//
// Punto ciego real (24/07/2026, LOSU Tema 6 Téc. Aux. Univ. Murcia, caso Mario):
// el epígrafe nombraba "Título I, Título II, Título IX Cap I" pero el scope tenía
// art.1 (Título Preliminar) y art.6 (Título III). Lo introdujo el PROPIO
// verify:scope al razonar por RANGO contiguo ("Título I+II = arts 1-6") en vez de
// por pertenencia real a cada título (I+II = arts 2-5); cogió un artículo de más
// en cada frontera. Ni el detector de sobre-inclusión (`scopeOverInclusion`, busca
// "casi la ley ENTERA") ni los de huecos lo ven: el scope es ajustado y sirve
// preguntas → parece sano. Solo lo caza mapear CADA artículo a su título.
//
// DETERMINISTA. Necesita la estructura título→rango de la ley (de
// `parseBoeSections` sobre el índice del BOE). Solo APLICA cuando el epígrafe
// ENUMERA títulos explícitos ("Título I", "Título IX"); si es prosa descriptiva
// sin títulos → no aplica (eso es scopeOverInclusion).
//
// CommonJS puro (como parseBoeSections.js) → lo usan a la vez el test, el runner
// `scripts/scope/sim-title-boundary.ts` y `scripts/health-sweep.cjs`, SIN mirror
// que se desincronice. Fijado por __tests__/lib/laws/scopeTitleBoundary.test.ts.

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }

/** "IX" → 9. null si no es romano válido. */
function romanToInt(s) {
  s = String(s || '').toUpperCase().replace(/\.BIS$/, '')
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN[s[i]]
    const nxt = ROMAN[s[i + 1]]
    if (cur == null) return null
    n += nxt && cur < nxt ? -cur : cur
  }
  return s.length ? n : null
}

/** num de sección de parseBoeSections ('Preliminar'|'I'|'IV'…) → entero (0=Preliminar). */
function seccionNumToInt(num) {
  if (num == null) return null
  if (/prelim/i.test(String(num))) return 0
  return romanToInt(num)
}

// Tokens de contenido (≥6 letras, sin stopwords largas) para cotejar la RÚBRICA de
// un título contra el epígrafe. SIN stemming a propósito: "funciones" (epígrafe,
// Título I LOSU) NO debe casar con "función docente" (rúbrica Título III) — si
// stemizáramos, enmascararíamos el overflow real del art.6. Match exacto tras
// normalizar acentos/mayúsculas.
const STOP_RUBRICA = new Set(['sobre', 'entre', 'desde', 'hasta', 'contra', 'segun', 'entrada', 'mediante'])
function sigTokens(s) {
  return (String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9ñ]+/g) || [])
    .filter((w) => w.length >= 6 && !STOP_RUBRICA.has(w))
}

/**
 * ¿El epígrafe nombra un título por su MATERIA (rúbrica)? Exime del overflow los
 * títulos que el epígrafe cita por nombre aunque NO por número (caso CE Título VIII
 * "De la Organización Territorial del Estado" en un epígrafe que dice justo eso).
 * Conservador: exige ≥2 tokens de contenido compartidos Y que cubran ≥50% de la
 * rúbrica (un solo token común, p.ej. "estado", no basta para eximir).
 */
function epigrafeNamesRubrica(epigrafe, rubrica) {
  const rt = [...new Set(sigTokens(rubrica))]
  if (rt.length < 2) return false
  const et = new Set(sigTokens(epigrafe))
  const shared = rt.filter((w) => et.has(w))
  return shared.length >= 2 && shared.length / rt.length >= 0.5
}

/** Títulos NOMBRADOS explícitamente en el epígrafe → enteros únicos (0=Preliminar). */
function epigrafeTitles(epigrafe) {
  const out = new Set()
  const re = /[Tt][íi]tulo\s+(Preliminar|[IVXLC]+(?:\.bis)?)/g
  let m
  while ((m = re.exec(epigrafe || '')) !== null) {
    if (/prelim/i.test(m[1])) out.add(0)
    else { const v = romanToInt(m[1]); if (v != null) out.add(v) }
  }
  return [...out].sort((a, b) => a - b)
}

/**
 * @param {string} epigrafe        texto literal del epígrafe del tema
 * @param {{num:string,from:number,to:number}[]} secciones  estructura título→rango (parseBoeSections)
 * @param {(string|number)[]} scopedArticles  article_numbers de la entrada de topic_scope
 * @returns {{applicable:boolean, allowedTitles:number[], overflow:{article:number,titulo:string}[], unmapped:number[]}}
 */
function classifyTitleBoundary(epigrafe, secciones, scopedArticles) {
  const allowedTitles = epigrafeTitles(epigrafe)
  if (!allowedTitles.length) return { applicable: false, allowedTitles: [], overflow: [], unmapped: [] }

  const overflow = []
  const unmapped = []
  for (const raw of scopedArticles || []) {
    // Solo artículos numéricos puros ("6"); "6.bis"/"DA1"/… fuera de v1.
    const a = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
    if (!Number.isInteger(a) || String(raw).trim() !== String(a)) continue

    const sec = (secciones || []).find((s) => a >= s.from && a <= s.to)
    if (!sec) { unmapped.push(a); continue } // sin estructura → NO se marca (fail-safe)
    const tInt = seccionNumToInt(sec.num)
    if (tInt == null) continue
    if (allowedTitles.includes(tInt)) continue                       // el epígrafe lo nombra por NÚMERO
    if (sec.rubrica && epigrafeNamesRubrica(epigrafe, sec.rubrica)) continue // …o por MATERIA (rúbrica)
    overflow.push({ article: a, titulo: sec.num })
  }
  return { applicable: true, allowedTitles, overflow, unmapped }
}

module.exports = { classifyTitleBoundary, seccionNumToInt, epigrafeTitles, romanToInt, epigrafeNamesRubrica }
