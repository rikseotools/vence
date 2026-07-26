// lib/laws/lawNameMatch.cjs — ¿este epígrafe NOMBRA esta ley? (por número o por nombre)
//
// ## Por qué existe este fichero (T-129, 26/07/2026)
//
// Esta lógica vivía DENTRO de `scripts/audit-epigrafe-scope.cjs`, que abre conexión a la BD
// al cargarse y hace `process.exit(2)` sin `DATABASE_URL` → imposible reutilizarla desde
// `lib/` o desde un test. Era un silo: el único matcher ley↔epígrafe del proyecto,
// inaccesible para el resto. Promovido aquí SIN tocar su comportamiento (extraído verbatim);
// el script lo consume desde este módulo, así que hay UNA sola implementación y no puede
// desincronizarse.
//
// Lo usan:
//   · `scripts/audit-epigrafe-scope.cjs` — detector de leyes en scope que el epígrafe no nombra.
//   · `lib/laws/scopeTitleBoundary.js`   — para ATAR los títulos del epígrafe a su ley y no
//     aplicar "(Constitución, Título VIII)" al Estatuto de Andalucía (fuga de T-129).
//
// CommonJS puro (como `parseBoeSections.js` y `scopeTitleBoundary.js`): sin imports de app,
// sin BD, sin red. Fijado por `__tests__/lib/laws/lawNameMatch.test.js`.

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

module.exports = { extractLawRefs, norm, nameReferenced, STOP, ACRONYMS }
