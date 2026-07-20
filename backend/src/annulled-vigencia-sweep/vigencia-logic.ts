// backend/src/annulled-vigencia-sweep/vigencia-logic.ts
//
// MIRROR INLINE de la lógica pura de `lib/laws/boeVigencia.ts` + la parte de análisis de
// `lib/laws/annulledProvisions.ts` que este barrido necesita. El backend es self-contained
// (rootDir = backend/, nunca importa de ../lib), como content-health-sweep y law-completeness.
//
// ⚠️ MANTENER EN SYNC con lib/laws/boeVigencia.ts y lib/laws/annulledProvisions.ts.
// El test `annulled-vigencia-sweep.consistency.spec.ts` fija la equivalencia contra fixtures.
//
// Qué hace: dado el bloque XML de un artículo del BOE consolidado, extrae los incisos que el
// TC declaró nulos (`getAnnulledFragments`) para poblarlos en `articles.vigencia_notes` y así
// alimentar el gate de T-048 (`answer_falls_in_annulled_fragment`). Y del `/analisis` del BOE
// saca QUÉ artículos tienen anulación, para no bajar el bloque de todos.

export interface VigenciaNote {
  clase: string;
  texto: string;
  ref: string | null;
  esAnulacion: boolean;
}

export interface BoeBlock {
  text: string;
  vigenciaNotes: VigenciaNote[];
  highlightedFragments: string[];
}

const ANULACION_RE = /\b(inconstitucional|nulidad|nulos?|nulas?|se anula)\b/i;

function decode(s: string): string {
  const named: Record<string, string> = {
    aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
    Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
    laquo: '«', raquo: '»', nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
    deg: '°', ordm: 'º', ordf: 'ª', hellip: '…', mdash: '—', ndash: '–',
  };
  return s
    .replace(/&([a-zA-Z]+);/g, (m, n) => (n in named ? named[n] : m))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function stripTags(s: string): string {
  return decode(s.replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').trim();
}

/** Parsea un bloque del BOE consolidado (XML). Nunca lanza. Mirror de boeVigencia.parseBoeBlock. */
export function parseBoeBlock(raw: string): BoeBlock {
  if (!raw) return { text: '', vigenciaNotes: [], highlightedFragments: [] };

  const vigenciaNotes: VigenciaNote[] = [];
  for (const bq of raw.match(/<blockquote>[\s\S]*?<\/blockquote>/gi) ?? []) {
    for (const p of bq.match(/<p\s+class="(nota[^"]*)"[^>]*>([\s\S]*?)<\/p>/gi) ?? []) {
      const clase = (p.match(/class="([^"]+)"/i) ?? [])[1] ?? 'nota';
      const ref = (p.match(/Ref\.\s*(BOE-[A-Z]-\d{4}-\d+)/i) ?? [])[1] ?? null;
      const texto = stripTags(p);
      if (texto && !vigenciaNotes.some((n) => n.texto === texto)) {
        vigenciaNotes.push({ clase, texto, ref, esAnulacion: ANULACION_RE.test(texto) });
      }
    }
  }

  const sinNotas = raw.replace(/<blockquote>[\s\S]*?<\/blockquote>/gi, ' ');

  const highlightedFragments = [
    ...new Set(
      (sinNotas.match(/<strong>([\s\S]*?)<\/strong>/gi) ?? []).map((s) => stripTags(s)).filter(Boolean),
    ),
  ];

  const cuerpo = sinNotas.replace(/<\/p>/gi, '\n').replace(/<\/?(response|status|code|text|data)>/gi, ' ');
  const text = decode(cuerpo.replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .trim();

  return { text, vigenciaNotes, highlightedFragments };
}

/** Mirror de boeVigencia.getAnnulledFragments. */
export function getAnnulledFragments(block: BoeBlock): string[] {
  return block.vigenciaNotes.some((n) => n.esAnulacion) ? block.highlightedFragments : [];
}

// ── Análisis del BOE → qué artículos tienen anulación del TC (mirror de annulledProvisions) ──

const ART_RE = /art(?:[íi]culos?|\.|\b)\s*(\d+(?:\s*bis)?)/gi;
const ANNUL_BEFORE = /\binconstitucional|\bnul(?:idad|o|a|os|as)\b|\banulad/i;
const CROSSREF_AFTER =
  /^\s*\.?\d*\s*(?:bis\s*)?de\s+(?:la\s+)?(?:ley|l\.?\s*o\.?|real\s+decreto|rd\b|decreto|reglamento)/i;

/** Mirror de annulledProvisions.parseAnnulledArticles. */
export function parseAnnulledArticles(texto: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  ART_RE.lastIndex = 0;
  while ((m = ART_RE.exec(texto)) !== null) {
    const before = texto.slice(Math.max(0, m.index - 55), m.index);
    if (!ANNUL_BEFORE.test(before)) continue;
    const after = texto.slice(m.index + m[0].length, m.index + m[0].length + 40);
    if (CROSSREF_AFTER.test(after)) continue;
    out.add(m[1].replace(/\s+/g, ' ').trim().toLowerCase());
  }
  return [...out];
}

export function parseSentencia(texto: string): string | null {
  const m = texto.match(/Sentencia\s+(\d+\/\d{4})/i);
  return m ? `STC ${m[1]}` : null;
}

export interface TcAnnulment {
  idNorma: string | null;
  sentencia: string | null;
  articles: string[];
  texto: string;
}

/** Mirror de annulledProvisions.extractTcAnnulments. */
export function extractTcAnnulments(analisisJson: any): TcAnnulment[] {
  const posteriores = analisisJson?.data?.[0]?.referencias?.posteriores?.[0]?.posterior ?? [];
  const res: TcAnnulment[] = [];
  for (const p of posteriores) {
    const rel = (p?.relacion?.texto || '').toUpperCase();
    const texto: string = p?.texto || '';
    if (!rel.includes('SE DECLARA')) continue;
    if (!/\binconstitucional|\bnul(?:idad|o|a)\b/i.test(texto)) continue;
    const articles = parseAnnulledArticles(texto);
    if (articles.length === 0) continue;
    res.push({ idNorma: p?.id_norma ?? null, sentencia: parseSentencia(texto), articles, texto });
  }
  return res;
}

/** Normaliza 'Artículo 126' / 'art. 126 bis' → clave comparable con articles.article_number. */
export function normArticleKey(s: string): string {
  return String(s).replace(/^art[íi]culo\s*/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
