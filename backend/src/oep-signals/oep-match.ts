/**
 * Matcher PURO de convocatorias detectadas ↔ oposiciones del catálogo.
 *
 * Reemplaza al matcher hardcodeado (solo "auxiliar administrativo" /
 * "administrativo" + "región aparece en el slug") que producía:
 *   - FALSOS NEGATIVOS: nada estatal casaba (la región nunca está en el slug
 *     de un cuerpo nacional → IIPP, Guardia Civil, etc. salían siempre novel).
 *   - FALSOS POSITIVOS: casaba por familia+región sin mirar el NIVEL de
 *     administración → "Administrativo (Ayuntamiento de Ávila)" casaba con la
 *     oposición autonómica `auxiliar-administrativo-cyl`, y "Administrativo
 *     (Universidad de León)" también, en vez de con `administrativo-universidad-leon`.
 *     Además clasificaba la familia usando el ORGANISMO ("Consejería de ...
 *     Administración ..." disparaba la familia "administrativo").
 *
 * Principio de diseño: **precisión > recall**. Un no-match deja la señal como
 * `is_novel=true` (visible y triable por un humano); un falso match corrompe la
 * BD vinculando una convocatoria a la oposición equivocada. Ante la duda, novel.
 *
 * El casado exige coincidencia en TRES ejes independientes:
 *   1. FAMILIA del cuerpo (clasificada SOLO desde el cuerpo, nunca el organismo).
 *   2. NIVEL de administración (estatal / autonómico / local-ayto / local-dip /
 *      universidad), y dentro de local/universidad, la MISMA entidad.
 *   3. GRUPO (C1/C2) compatible cuando ambos se conocen.
 *
 * Es una función pura sin acceso a BD → testeable con fixtures reales.
 */

/** Familias de cuerpo que modelamos. `null` = cuerpo no modelado → novel. */
export type Family =
  | 'aux_admin'
  | 'admin'
  | 'penitenciarias'
  | 'auxilio_judicial'
  | 'tramitacion_procesal'
  | 'guardia_civil'
  | 'policia_nacional'
  | 'policia_local'
  | 'tcae'
  | 'celador'
  | 'enfermero'
  | 'correos';

/** Nivel de administración de una convocatoria/oposición. */
export type AdminScope =
  | 'national'
  | 'autonomic'
  | 'local-ayto'
  | 'local-dip'
  | 'local-consell'
  | 'university'
  | 'other';

/** Convocatoria detectada (la forma viene del adapter PAG). */
export interface DetectedOep {
  cuerpo: string;
  /** 'C1' | 'C2' | '' */
  grupo?: string | null;
  /** Estatal | Autonómica | Local | Universidad | Otra */
  admin?: string | null;
  /** Nombre de CCAA ('Nacional', 'La Rioja', ...). */
  ccaa?: string | null;
  organismo?: string | null;
}

/** Oposición candidata del catálogo. */
export interface OposicionCandidate {
  id: string;
  nombre: string;
  slug: string | null;
  shortName?: string | null;
  subgrupo?: string | null;
  administracion?: string | null;
}

export interface MatchResult {
  matched: boolean;
  oposicionId: string | null;
  oposicionNombre: string | null;
  /** Traza legible de por qué casó (o no) — útil en logs/triaje. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Normalización
// ---------------------------------------------------------------------------

/** minúsculas, sin acentos, no-alfanumérico→espacio, colapsa espacios. */
export function normalize(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Familia del cuerpo
// ---------------------------------------------------------------------------

// ORDEN IMPORTA: las reglas específicas (penitenciarias, auxilio judicial,
// auxiliar administrativo) van ANTES que las genéricas (administrativo). Se
// aplica la primera que casa. `auxiliar administrativo` antes que
// `administrativo`, y `auxiliar de enfermeria` (tcae) antes que cualquier
// "auxiliar" suelto.
const FAMILY_RULES: ReadonlyArray<readonly [Family, RegExp]> = [
  ['penitenciarias', /penitenciari/],
  ['auxilio_judicial', /auxilio judicial/],
  ['tramitacion_procesal', /tramitacion procesal|gestion procesal/],
  ['guardia_civil', /guardia civil/],
  ['policia_nacional', /policia nacional/],
  ['policia_local', /policia (local|municipal)/],
  ['tcae', /\btcae\b|cuidados auxiliares de enfermeria|auxiliar(es)? de enfermeria|auxiliar(es)? enfermeria/],
  ['celador', /\bcelador/],
  ['enfermero', /\benfermer[oa]/],
  ['correos', /\bcorreos\b/],
  ['aux_admin', /auxiliar(es)? administrativ/],
  ['admin', /administrativ/],
];

/**
 * Clasifica un texto (cuerpo, o slug+short_name de una oposición) en una
 * familia. Devuelve `null` si no encaja en ninguna familia modelada.
 */
export function classifyFamily(text: string): Family | null {
  const n = normalize(text);
  for (const [fam, re] of FAMILY_RULES) {
    if (re.test(n)) return fam;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Scope (nivel de administración) + tokens de entidad/lugar
// ---------------------------------------------------------------------------

// Palabras de TIPO de organismo/entidad: se eliminan para quedarnos con el
// nombre propio del lugar/entidad ("Universidad de León" → "leon").
const TYPE_WORDS =
  /\b(ayuntamiento|diputacion|universidad|politecnica|consell|consorci|consorcio|mancomunidad|cabildo|insular|gobierno|junta|consejeria|conselleria|ministerio|generalitat|principado|comunidad|autonoma|region|provincial|excmo|excma|illes|govern|xunta|agencia|tributaria)\b/g;

// Palabras de FAMILIA: se eliminan del slug para aislar el lugar.
const FAMILY_WORDS =
  /\b(auxiliar|administrativo|administrativos|administrativa|ayudante|ayudantes|instituciones|penitenciarias|tcae|celador|enfermero|enfermera|enfermeria|auxilio|judicial|tramitacion|procesal|guardia|civil|policia|correos|personal|operativo|tecnico|tecnica|especialista|escala|basica|agente|cuerpo|general|servicios|generales)\b/g;

const STOP = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'o', 'a',
]);

/** Tokens significativos de lugar/entidad de un texto ya sin tipo/familia. */
function placeTokens(text: string): string[] {
  return normalize(text)
    .replace(TYPE_WORDS, ' ')
    .replace(FAMILY_WORDS, ' ')
    .split(' ')
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** Scope + tokens de lugar de la convocatoria DETECTADA (PAG). */
export function detectedScope(
  admin?: string | null,
  organismo?: string | null,
): { scope: AdminScope; place: string[] } {
  const a = normalize(admin ?? '');
  const org = organismo ?? '';
  if (a.includes('estatal')) return { scope: 'national', place: [] };
  if (a.includes('autonomica')) return { scope: 'autonomic', place: [] };
  if (a.includes('universidad')) return { scope: 'university', place: placeTokens(org) };
  if (a.includes('local')) {
    const no = normalize(org);
    if (/diputacion/.test(no)) return { scope: 'local-dip', place: placeTokens(org) };
    if (/consell|cabildo|consorci|mancomunidad/.test(no))
      return { scope: 'local-consell', place: placeTokens(org) };
    // Por defecto un ente local es un ayuntamiento.
    return { scope: 'local-ayto', place: placeTokens(org) };
  }
  return { scope: 'other', place: placeTokens(org) };
}

// Oposiciones estatales cuyo slug no lleva sufijo de región.
const NATIONAL_SLUGS = new Set([
  'administrativo-estado',
  'auxiliar-administrativo-estado',
  'administrativo-seguridad-social',
  'ayudante-instituciones-penitenciarias',
  'auxilio-judicial',
  'tramitacion-procesal',
  'gestion-procesal',
  'guardia-civil',
  'policia-nacional',
  'correos-personal-operativo',
  'auxiliar-administrativo-ingesa',
]);

const NATIONAL_ADMIN =
  /estado|estatal|general del estado|administracion de justicia|ministerio|correos|ingesa/i;

/** Scope + tokens de lugar de una OPOSICIÓN del catálogo. */
export function oposicionScope(
  slug?: string | null,
  administracion?: string | null,
): { scope: AdminScope; place: string[] } {
  const s = normalize(slug ?? '');
  if (s.includes('universidad'))
    return { scope: 'university', place: placeTokens(slug ?? '') };
  if (s.includes('ayuntamiento'))
    return { scope: 'local-ayto', place: placeTokens(slug ?? '') };
  if (s.includes('diputacion'))
    return { scope: 'local-dip', place: placeTokens(slug ?? '') };
  if (/\bconsell\b|cabildo/.test(s))
    return { scope: 'local-consell', place: placeTokens(slug ?? '') };
  if (
    NATIONAL_SLUGS.has((slug ?? '').toLowerCase()) ||
    s.endsWith(' estado') ||
    NATIONAL_ADMIN.test(administracion ?? '')
  ) {
    return { scope: 'national', place: [] };
  }
  return { scope: 'autonomic', place: placeTokens(slug ?? '') };
}

// ---------------------------------------------------------------------------
// Alias de CCAA (la región del PAG ↔ cómo aparece en los slugs)
// ---------------------------------------------------------------------------

const CCAA_ALIASES: Record<string, string[]> = {
  andalucia: ['andalucia'],
  aragon: ['aragon'],
  asturias: ['asturias'],
  baleares: ['baleares', 'illes balears', 'balears'],
  canarias: ['canarias'],
  cantabria: ['cantabria'],
  'castilla y leon': ['castilla leon', 'castilla y leon', 'cyl'],
  'castilla la mancha': ['castilla la mancha', 'clm'],
  cataluna: ['catalunya', 'cataluna'],
  'c valenciana': ['valencia', 'valenciana', 'gva'],
  'comunidad valenciana': ['valencia', 'valenciana', 'gva'],
  extremadura: ['extremadura'],
  galicia: ['galicia'],
  madrid: ['madrid'],
  murcia: ['murcia', 'carm'],
  navarra: ['navarra'],
  'pais vasco': ['pais vasco', 'euskadi'],
  'la rioja': ['la rioja', 'rioja'],
};

/** Alias de slug para una CCAA detectada. */
export function ccaaAliases(ccaa?: string | null): string[] {
  const key = normalize(ccaa ?? '');
  return CCAA_ALIASES[key] ?? (key ? [key] : []);
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function groupCompatible(detGrupo?: string | null, subgrupo?: string | null): boolean {
  const d = normalize(detGrupo ?? '');
  const o = normalize(subgrupo ?? '');
  if (!d || !o) return true; // si falta alguno, no se puede descartar
  // Solo nos interesan C1/C2; comparamos esos tokens exactos.
  const dc = d.match(/c[12]/)?.[0];
  const oc = o.match(/c[12]/)?.[0];
  if (!dc || !oc) return true;
  return dc === oc;
}

function placesIntersect(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false;
  const setB = new Set(b);
  return a.some((t) => setB.has(t));
}

/**
 * ¿Casa la convocatoria detectada `d` con la oposición `o`? Pura.
 */
export function scoreMatch(d: DetectedOep, o: OposicionCandidate): MatchResult {
  const no = (reason: string): MatchResult => ({
    matched: false,
    oposicionId: null,
    oposicionNombre: null,
    reason,
  });

  // 1) Familia (clasificada SOLO desde el cuerpo, nunca el organismo).
  const famD = classifyFamily(d.cuerpo);
  if (!famD) return no(`cuerpo "${d.cuerpo}" sin familia modelada`);
  const famO = classifyFamily(`${o.slug ?? ''} ${o.shortName ?? ''}`);
  if (!famO) return no(`oposicion ${o.slug} sin familia`);
  if (famD !== famO) return no(`familia distinta (${famD} vs ${famO})`);

  // 2) Grupo C1/C2 compatible.
  if (!groupCompatible(d.grupo, o.subgrupo))
    return no(`grupo incompatible (${d.grupo} vs ${o.subgrupo})`);

  // 3) Nivel de administración + entidad.
  const sd = detectedScope(d.admin, d.organismo);
  const so = oposicionScope(o.slug, o.administracion);
  if (sd.scope !== so.scope)
    return no(`scope distinto (${sd.scope} vs ${so.scope})`);

  switch (sd.scope) {
    case 'national':
      break; // familia + nacional basta
    case 'autonomic': {
      const aliases = ccaaAliases(d.ccaa);
      const slugN = normalize(o.slug ?? '');
      if (!aliases.some((al) => slugN.includes(al)))
        return no(`region ${d.ccaa} no aparece en slug ${o.slug}`);
      break;
    }
    case 'local-ayto':
    case 'local-dip':
    case 'local-consell':
    case 'university':
      if (!placesIntersect(sd.place, so.place))
        return no(
          `entidad distinta (${sd.place.join('+') || '∅'} vs ${so.place.join('+') || '∅'})`,
        );
      break;
    default:
      return no(`scope no casable (${sd.scope})`);
  }

  return {
    matched: true,
    oposicionId: o.id,
    oposicionNombre: o.nombre,
    reason: `${famD} · ${sd.scope}${sd.place.length ? ' ' + sd.place.join('+') : ''}`,
  };
}

/**
 * Elige el mejor match entre los candidatos. Si varios casan, prefiere el que
 * tiene grupo exacto y el slug más corto (más específico/canónico).
 */
export function pickBestMatch(
  d: DetectedOep,
  candidates: OposicionCandidate[],
): MatchResult {
  const hits = candidates
    .map((o) => ({ o, r: scoreMatch(d, o) }))
    .filter((x) => x.r.matched);

  if (hits.length === 0) {
    return { matched: false, oposicionId: null, oposicionNombre: null, reason: 'sin candidato' };
  }

  hits.sort((a, b) => {
    const ga = groupCompatible(d.grupo, a.o.subgrupo) && !!normalize(a.o.subgrupo ?? '');
    const gb = groupCompatible(d.grupo, b.o.subgrupo) && !!normalize(b.o.subgrupo ?? '');
    if (ga !== gb) return ga ? -1 : 1;
    return (a.o.slug ?? '').length - (b.o.slug ?? '').length;
  });

  return hits[0].r;
}
