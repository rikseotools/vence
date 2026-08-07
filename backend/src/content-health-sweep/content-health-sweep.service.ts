import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { pgTextArray } from '../db/sql-arrays';
import { detectarReservaSinDeclarar } from './reserva-sin-declarar';

/**
 * Barrido de SALUD (app + contenido) → tabla `content_health_findings` + email.
 *
 * PORT IN-PROCESS de `scripts/health-sweep.cjs` (que se quedó fuera de la
 * migración GHA→Fargate del 07/07: el sweep nunca tuvo disparador y el panel
 * `/admin/contenido` quedaba congelado). Aquí corre como @Cron del backend
 * NestJS, igual que los otros batches pesados (refresh-theme-cache, boe-changes…),
 * sin límite de duración de endpoint y con heartbeat + observabilidad.
 *
 * FUENTE ÚNICA de la lógica de detección. `scripts/health-sweep.cjs` se conserva
 * como gemelo CLI para DRY/manual (mismas queries). MANTENER EN SYNC.
 *
 * SEPARACIÓN app/contenido: APP (usuario topa con error) → email siempre que haya;
 * CONTENIDO (calidad, app va) → email solo los lunes (revisión semanal). El
 * badge/panel lee la tabla a diario.
 */

interface Finding {
  category: 'app' | 'content';
  severity: 'error' | 'warn';
  slug: string | null;
  kind: string;
  message: string;
  detail: Record<string, unknown> | null;
}

export interface SweepSummary {
  total: number;
  appError: number;
  contentError: number;
  contentWarn: number;
  wrote: boolean;
  emailsSent: number;
  /**
   * Qué se cayó, si el barrido se cortó a mitad (T-307). `null` = pasada completa.
   *
   * Se devuelve en vez de propagar el throw: así `run()` puede terminar su trabajo útil
   * (escribir lo recogido, mandar los emails) y aun así el cron marca la ejecución como
   * FALLIDA — que es lo que leen las reglas de alerta. Antes las dos cosas eran incompatibles:
   * o se escribía, o se avisaba.
   */
  incompleto: { mensaje: string; sql: string | null } | null;
  /**
   * Qué `kind`s EVALUÓ esta pasada y cuántos sujetos miró cada uno (T-529, 05/08/2026).
   *
   * `content_health_findings` solo guarda lo que se ENCUENTRA: la ausencia de filas de un
   * kind significa a la vez «vigilado y limpio» y «nadie lo miró», y hoy se leen igual. Un
   * kind entra aquí en cuanto su bloque de detección TERMINA de mirar su población — con
   * hallazgos o sin ellos — así que un 0 en `content_health_findings` se puede afirmar como
   * «se evaluó y no hay nada» en vez de sospecharse como detector muerto. Si el barrido se
   * corta a mitad (`incompleto`), solo llevan los kinds cuyo bloque llegó a completarse antes
   * del corte — es justo la foto que hace falta para saber qué NO se pudo mirar esta noche.
   *
   * Resumen POR PASADA (kind → nº de sujetos mirados), no una fila por sujeto: son ~45 kinds
   * y el barrido ya es largo.
   */
  kindsEvaluados: Record<string, number>;
}

const esc = (s: unknown): string =>
  String(s).replace(
    /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string,
  );

function cardInt(n: unknown): number | null {
  if (n == null) return null;
  if (typeof n !== 'string' && typeof n !== 'number') return null;
  const s = String(n).trim();
  if (/\{\w+\}/.test(s)) return null;
  if (!/^[0-9][0-9.\s]*$/.test(s)) return null;
  const v = parseInt(s.replace(/[.\s]/g, ''), 10);
  return Number.isFinite(v) ? v : null;
}

interface StatCard {
  texto?: string;
  numero?: unknown;
}
function cardsAbout(est: unknown, w: string): StatCard[] {
  if (!Array.isArray(est)) return [];
  const re = new RegExp(w, 'i');
  return (est as StatCard[]).filter((c) => c && re.test(String(c.texto ?? '')));
}

const isCellLine = (l: string): boolean =>
  l.length > 0 &&
  l.length <= 30 &&
  !/[.:;]$/.test(l) &&
  !/^([a-zñ]\)|\d{1,3}\.)/.test(l) &&
  /[A-Za-z0-9]/.test(l);
const STRUCTURE_RE =
  /\b(T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N|SUBSECCI[OÓ]N|ANEXO|DISPOSICI[OÓ]N|LIBRO)\b/i;
// Mirror de lib/teoria/detectFlattenedTable.ts — pie/menú de la sede del BOE colado como celdas = FP.
const BOE_BOILERPLATE_RE =
  /\b(Aviso legal|Sobre la sede electr[oó]nica|Sistema Interno de Informaci[oó]n|Empleo en la AEBOE|Agencia Estatal Bolet[ií]n Oficial)\b/i;
function detectFlattenedTable(content: string | null): string[] | null {
  if (!content || !content.trim()) return null;
  const lines = content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  let best: string[] = [];
  let run: string[] = [];
  for (const l of lines) {
    if (isCellLine(l)) {
      run.push(l);
      if (run.length > best.length) best = run.slice();
    } else run = [];
  }
  if (best.length < 4) return null;
  const joined = best.join(' ');
  if (STRUCTURE_RE.test(joined) || BOE_BOILERPLATE_RE.test(joined)) return null;
  return best;
}

const TARGET_YEAR_RE =
  /\bpara\s+(?:el\s+a[ñn]o\s+)?(\d{4})\b|\bdel\s+(?:a[ñn]o|ejercicio)\s+(\d{4})\b/i;

interface VerificationSummary {
  no_consolidated_text?: boolean;
  historical?: boolean;
  deliberate_subset?: boolean;
  boe_count?: number;
  db_count?: number;
  missing_in_db?: number;
  content_mismatch?: number;
  title_mismatch?: number;
}
function classifyLaw(
  isVirtual: boolean | null,
  boeUrl: string | null,
  status: string | null,
  su: VerificationSummary | null,
): string | null {
  const hasSource = !!(boeUrl && String(boeUrl).trim());
  const claims = ['actualizada', 'verificada'].includes(
    (status || '').toLowerCase(),
  );
  if (isVirtual === true) return null;
  if (!su) {
    if (claims) return 'false_green';
    if (!hasSource) return 'no_source';
    return 'never_verified';
  }
  if (
    su.no_consolidated_text === true ||
    su.historical === true ||
    su.deliberate_subset === true
  )
    return null;
  const nn = (x: unknown): number | null =>
    typeof x === 'number' && Number.isFinite(x) ? x : null;
  const boe = nn(su.boe_count);
  const db = nn(su.db_count);
  const missing =
    nn(su.missing_in_db) ??
    (boe != null && db != null ? Math.max(0, boe - db) : null);
  if (missing != null && missing > 0) return 'incomplete';
  if ((nn(su.content_mismatch) ?? 0) > 0 || (nn(su.title_mismatch) ?? 0) > 0)
    return 'issues';
  return null;
}

// Mirror INLINE de lib/convocatoria/examenPasadoEnTexto.cjs — MANTENER EN SYNC.
// Detecta textos libres (landing_faqs/description) que anuncian un examen como VIGENTE
// con una fecha YA PASADA (el opositor lee una fecha vieja como la próxima). Calibrado:
// solo el ENGAÑO (presentado como vigente), no el histórico ni fechas de plazo/publicación.
const MESES_EXAM: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const ES_EXAMEN = /\b(examen|ejercicio|prueba)\b/i;
const NO_EXAMEN =
  /plazo|solicitud|inscripci|se public|publicad|publicaron|cerr[óo]|finaliz|resultado|lista|admitid|nombramiento/i;
const VIGENTE_EXAM =
  /\b(es el|es la|ser[áa]|tendr[áa] lugar|se celebrar[áa]|previsto para|prevista para|convocado para|convocada para|examen el|examen es|fecha del examen|se realizar[áa])\b/i;
const PASADO_EXAM =
  /(^|\s)se celebr[óo]|(^|\s)celebr[óo]|celebrad[oa]|tuvo lugar|se realiz[óo]|realizad[oa]|ya (se )?celebr|examen fue/i;
function extraerFechasExam(txt: string): Array<{ iso: string; idx: number }> {
  const out: Array<{ iso: string; idx: number }> = [];
  const re1 =
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(20\d\d)/gi;
  for (const m of txt.matchAll(re1))
    out.push({
      iso: `${m[3]}-${String(MESES_EXAM[m[2].toLowerCase()]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`,
      idx: m.index ?? 0,
    });
  const re2 = /(\d{1,2})\/(\d{1,2})\/(20\d\d)/g;
  for (const m of txt.matchAll(re2))
    out.push({
      iso: `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`,
      idx: m.index ?? 0,
    });
  return out;
}
function examenPasadoPresentadoVigente(
  texto: string | null | undefined,
  hoyIso: string,
): Array<{ iso: string; contexto: string }> {
  if (!texto) return [];
  const t = String(texto);
  const hits: Array<{ iso: string; contexto: string }> = [];
  for (const f of extraerFechasExam(t)) {
    if (f.iso >= hoyIso) continue;
    const ctx = t.slice(Math.max(0, f.idx - 55), f.idx + 15);
    if (!ES_EXAMEN.test(ctx)) continue;
    if (NO_EXAMEN.test(ctx)) continue;
    if (PASADO_EXAM.test(ctx)) continue;
    if (!VIGENTE_EXAM.test(ctx)) continue;
    hits.push({ iso: f.iso, contexto: ctx.replace(/\s+/g, ' ').trim() });
  }
  return hits;
}
function detectarExamenPasado(
  data: { landingDescription?: unknown; landingFaqs?: unknown },
  hoyIso: string,
): Array<{ iso: string; contexto: string }> {
  const textos: string[] = [];
  if (data.landingDescription) textos.push(String(data.landingDescription));
  if (Array.isArray(data.landingFaqs))
    for (const f of data.landingFaqs as Array<{ pregunta?: string; respuesta?: string }>)
      textos.push(`${f.pregunta || ''} ${f.respuesta || ''}`);
  return textos.flatMap((t) => examenPasadoPresentadoVigente(t, hoyIso));
}

// Mirror INLINE de scripts/health-sweep.cjs (scope_over_inclusion_suspect) — MANTENER EN SYNC.
function romanToInt(s: string): number | null {
  s = s.toUpperCase().replace(/\.BIS$/, '');
  const R: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = R[s[i]],
      nxt = R[s[i + 1]];
    if (cur == null) return null;
    n += nxt && cur < nxt ? -cur : cur;
  }
  return n;
}
function classifyScope(
  lawTotal: number,
  scopedCount: number,
  ep: string | null,
): { band: string; score: number; coverage: number; reason: string | null } {
  ep = ep || '';
  const coverage = lawTotal > 0 ? scopedCount / lawTotal : 0;
  const hasColon = /:/.test(ep);
  const titulos: number[] = [];
  let m: RegExpExecArray | null;
  const reTit = /[Tt][íi]tulo\s+(Preliminar|[IVXLC]+(?:\.bis)?)/g;
  while ((m = reTit.exec(ep)) !== null) {
    const v = /preliminar/i.test(m[1]) ? 0 : romanToInt(m[1]);
    if (v != null) titulos.push(v);
  }
  const titSet = [...new Set(titulos)].sort((a, b) => a - b);
  let titComplete: boolean | null = null,
    titGap = false;
  if (titSet.length >= 2) {
    const max = titSet[titSet.length - 1];
    const miss: number[] = [];
    for (let i = titSet[0]; i <= max; i++) if (!titSet.includes(i)) miss.push(i);
    titGap = miss.length > 0;
    titComplete = !titGap;
  }
  const closureWord =
    /\breforma\b|disposici[oó]n(?:es)?\s+(?:adicional|transitoria|derogatoria|final)/i.test(ep);
  let segments = 0;
  if (hasColon)
    segments = ep
      .slice(ep.indexOf(':') + 1)
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4 && /[a-záéíóúñ]/i.test(s)).length;
  // MIRROR de lib/laws/scopeOverInclusion.ts — enumeraciones con PUNTO (T-137, 31/07/2026),
  // descontando la CITA de la norma: «La Ley 19/2013, de 9 de diciembre, de transparencia…» son
  // 4 trozos que NO son materias, y contarlos haría enumerador a cualquiera que cite la ley.
  const RE_CITA_NORMA =
    /\b(?:ley\s+org[áa]nica|ley\s+foral|ley|real\s+decreto(?:\s+legislativo|\s+ley)?|decreto(?:\s+legislativo)?|reglamento|orden|resoluci[óo]n)\s+\d+\/\d{2,4}/i;
  const RE_SOLO_FECHA = /^de\s+\d{1,2}\s+de\s+[a-záéíóú]+$|^de\s+\d{4}$/i;
  const segmentsMaterias = (hasColon ? ep.slice(ep.indexOf(':') + 1) : ep)
    .split(/[;,.]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4 && /[a-záéíóúñ]/i.test(s))
    .filter((s) => !RE_SOLO_FECHA.test(s) && !RE_CITA_NORMA.test(s)).length;
  const explicitArts = new Set<number>();
  const reR = /art[íi]?c?u?l?o?s?\.?\s*(\d+)\s*(?:a|al|-|–)\s*(\d+)/gi;
  while ((m = reR.exec(ep)) !== null) {
    const a = +m[1],
      b = +m[2];
    if (b - a >= 0 && b - a < 500) for (let i = a; i <= b; i++) explicitArts.add(i);
  }
  const reS = /art[íi]?c?u?l?o?\.?\s*(\d+)(?!\s*(?:a|al|-|–)\s*\d)/gi;
  while ((m = reS.exec(ep)) !== null) explicitArts.add(+m[1]);
  const wholeLawWords =
    /[íi]ntegr|en su totalidad|toda la ley|texto [íi]ntegro|el conjunto de la ley|la ley completa/i.test(
      ep,
    );
  // MIRROR de lib/laws/scopeOverInclusion.ts — materia acotada en prosa (26/07/2026). Esta regla
  // llegó al núcleo y al gemelo CLI ese día y NUNCA se copió aquí, o sea que el @Cron nocturno
  // —el writer real— llevaba desde entonces ciego a la banda entera: el caso que la motivó (el
  // RGPD con sus 99 artículos escopados para «Conceptos y Principios») no se emitía nunca. Lo
  // destapó el test de espejo contra fixtures al extenderlo al backend [T-088/T-137].
  const acotaMateria = (ep.match(
    /(concepto[s]?|principio[s]?|disposicion(?:es)? general(?:es)?|[áa]mbito de aplicaci[óo]n|definici[óo]n(?:es)?|especialmente protegid\w*|objeto y [áa]mbito)/i,
  ) || [null])[0];
  const bigLaw = lawTotal >= 12,
    nearFull = coverage >= 0.9,
    veryBigLawEnum = lawTotal >= 60,
    // El PUNTO exige el suelo de 60 arts: es señal más débil que un ';' tras dos puntos (el
    // punto también termina frases normales). Caso etiquetado que lo fija: «El archivo.
    // Concepto. Tipos de archivos.» sobre 22 artículos es LEGÍTIMO.
    enumerator = (hasColon && segments >= 3) || (veryBigLawEnum && segmentsMaterias >= 3);
  if (wholeLawWords) return { band: 'CLEARED', score: 0, coverage, reason: null };
  if (titComplete && closureWord && nearFull)
    return { band: 'CLEARED', score: 0, coverage, reason: null };
  let score = 0,
    reason: string | null = null;
  if (explicitArts.size > 0 && bigLaw && scopedCount >= explicitArts.size * 2 && nearFull) {
    score += 60;
    reason = `epígrafe cita ${explicitArts.size} arts concretos pero scope tiene ${scopedCount}/${lawTotal}`;
  }
  if (titGap && nearFull && bigLaw) {
    score += 50;
    reason = reason || `epígrafe nombra títulos con huecos (${titSet.join(',')}) pero scope cubre toda la ley`;
  }
  if (bigLaw && nearFull && enumerator) {
    score += 30;
    reason =
      reason ||
      `ley grande (${lawTotal}) casi completa (${(coverage * 100).toFixed(0)}%) con epígrafe que enumera ${Math.max(segments, segmentsMaterias)} bloques`;
  }
  // Exige `!enumerator` para no sumarse a la de arriba y promover a HIGH por acumulación.
  if (veryBigLawEnum && nearFull && !enumerator && acotaMateria) {
    score += 30;
    reason =
      reason ||
      `ley muy grande (${lawTotal}) escopada al ${(coverage * 100).toFixed(0)}% pero el epígrafe ACOTA la materia en prosa ("${acotaMateria}") sin enumerar bloques`;
  }
  const band = score >= 50 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'NONE';
  return { band, score, coverage, reason };
}

// Mirror INLINE de lib/convocatoria/linkCoherence.cjs — MANTENER EN SYNC.
// El enlace "Ver en BOE" (programa_url) debe apuntar al MISMO documento que la referencia
// mostrada (boe_reference). Si ambos citan un BOE-… y difieren → el usuario pincha y aterriza
// en otro documento (medido 25/07: 5 vigentes mostraban la OEP 2026 y enlazaban a la conv. 2025).
function extraerIdBoeInline(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const m = String(texto).match(/BOE-[A-Z]-\d{4}-\d+/);
  return m ? m[0] : null;
}

// Mirror INLINE del registro de boletines de lib/convocatoria/canonicalizeBoletinUrl.cjs
// (PATTERNS) — MANTENER EN SYNC. Solo los patrones de los que estamos SEGUROS: si la URL no
// se reconoce se devuelve null y NO se emite hallazgo (la cola larga de BOP provinciales y
// sedes electrónicas es legítima). Añadir un boletín = una fila aquí y otra en PATTERNS.
const BOLETIN_URL_PATTERNS: Array<{ boletin: string; re: RegExp }> = [
  { boletin: 'BOE', re: /\bBOE-[ABS]-\d{4}-\d+\b/i },
  { boletin: 'BOCM', re: /\bBOCM-\d{8}-\d+\b/i },
  { boletin: 'DOGV', re: /dogv\.gva\.es\/datos\/\d{4}\/\d{2}\/\d{2}\/pdf\/\d{4}_\d+/i },
  { boletin: 'BOCYL', re: /BOCYL-[A-Z]-\d{8}-\d+-\d+/i },
  { boletin: 'DOGC', re: /portaldogc\.gencat\.cat.*?documentId=\d+/i },
  { boletin: 'BOC', re: /gobiernodecanarias\.org\/boc\/\d{4}\/\d+\/\d+/i },
  { boletin: 'BOC', re: /gobiernodecanarias\.org\/boc\/boc-[a-z]-\d{4}-\d+-\d+/i },
  { boletin: 'BOJA', re: /juntadeandalucia\.es\/boja\/\d{4}\/\d+\/\d+/i },
  { boletin: 'BOJA', re: /juntadeandalucia\.es\/eboja\/\d{4}\/\d+\/BOJA\d{2}-\d+-\d+/i },
  { boletin: 'DOG', re: /xunta\.gal\/dog\/Publicados\/\d{4}\/\d{8}\/Anuncio[A-Z0-9-]+/i },
  // Añadidos el 28/07 (T-221) junto con su rama en boletin_doc_key: son los boletines cuyo
  // enlace de ANUNCIO ya emite el sensor de sumarios y que verificamos uno a uno contra la
  // URL real. DOE y BOPV NO entran: la suya es un envoltorio, no el documento.
  { boletin: 'BOPA', re: /miprincipado\.asturias\.es\/bopa\/.*dispositionReference=\d{4}-\d+/i },
  { boletin: 'BON', re: /bon\.navarra\.es\/[a-z]{2}\/anuncio\/-\/texto\/\d{4}\/\d+\/\d+/i },
  { boletin: 'BOME', re: /bomemelilla\.es\/bome\/BOME-[A-Z]-\d{4}-\d+\/articulo\/\d+/i },
  { boletin: 'DOCM', re: /docm\.jccm\.es\/.*ruta=\d{4}\/\d{2}\/\d{2}\/pdf\/\d{4}_\d+/i },
  { boletin: 'MIA', re: /(?:mia\.aragon\.es\/documentos\?csv=|carp-core-mia\.aragon\.es\/rest\/documentos\/)[A-Z0-9]{10,}/i },
];

// Mirror INLINE de BOLETIN_HOSTS (registro por DOMINIO) de canonicalizeBoletinUrl.cjs —
// MANTENER EN SYNC. Responde "¿esta URL es del boletín X?" sin necesidad de saber parsear su
// id: hasta 26/07 solo se reconocían los 9 de arriba y 56 de 123 landings activas quedaban en
// zona ciega (T-134). `path` acota los dominios que NO son solo boletín (euskadi.eus es el
// portal entero del Gobierno Vasco; gobiernodecanarias.org sirve BOC y Servicio Canario de Salud).
const BOLETIN_HOSTS: Array<{ boletin: string; hostRe: RegExp; pathRe?: RegExp }> = [
  { boletin: 'BOE', hostRe: /(^|\.)boe\.es$/ },
  { boletin: 'BOCM', hostRe: /(^|\.)bocm\.es$/ },
  { boletin: 'BORM', hostRe: /(^|\.)borm\.es$/ },
  { boletin: 'BOA', hostRe: /(^|\.)boa\.aragon\.es$/ },
  { boletin: 'DOE', hostRe: /(^|\.)doe\.juntaex\.es$/ },
  { boletin: 'BON', hostRe: /(^|\.)bon\.navarra\.es$/ },
  { boletin: 'BOC', hostRe: /(^|\.)boc\.cantabria\.es$/ },
  { boletin: 'BOC', hostRe: /(^|\.)gobiernodecanarias\.org$/, pathRe: /\/boc\// },
  { boletin: 'BOPA', hostRe: /(^|\.)asturias\.es$/, pathRe: /\/bopa\// },
  { boletin: 'BOR', hostRe: /(^|\.)larioja\.org$/, pathRe: /bor/i },
  { boletin: 'BOCYL', hostRe: /(^|\.)bocyl\.jcyl\.es$/ },
  { boletin: 'DOGC', hostRe: /(^|\.)dogc\.gencat\.cat$/ },
  { boletin: 'DOGV', hostRe: /(^|\.)dogv\.gva\.es$/ },
  { boletin: 'DOCM', hostRe: /(^|\.)docm\.jccm\.es$/ },
  { boletin: 'BOIB', hostRe: /(^|\.)boib\.caib\.es$/ },
  { boletin: 'BOUC', hostRe: /(^|\.)bouc\.ucm\.es$/ },
  { boletin: 'BOPZ', hostRe: /(^|\.)boletin\.dpz\.es$/ },
  { boletin: 'BOPV', hostRe: /(^|\.)euskadi\.eus$/, pathRe: /bopv/i },
  { boletin: 'BOJA', hostRe: /(^|\.)juntadeandalucia\.es$/, pathRe: /\/e?boja\// },
  { boletin: 'DOG', hostRe: /(^|\.)xunta\.gal$/, pathRe: /\/dog\// },
];

function boletinDeUrlInline(url: string | null | undefined): string | null {
  if (!url) return null;
  for (const p of BOLETIN_URL_PATTERNS) if (p.re.test(String(url))) return p.boletin;
  const sinEsquema = String(url)
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const corte = sinEsquema.search(/[/?]/);
  const host = (corte >= 0 ? sinEsquema.slice(0, corte) : sinEsquema)
    .toLowerCase()
    .replace(/^www\d*\./, '')
    .replace(/:\d+$/, '');
  const resto = corte >= 0 ? sinEsquema.slice(corte) : '';
  for (const h of BOLETIN_HOSTS) {
    if (!h.hostRe.test(host)) continue;
    if (h.pathRe && !h.pathRe.test(resto)) continue;
    return h.boletin;
  }
  return null;
}

// Mirror INLINE de `señalesDeUrl` + bandas de `enlace_no_es_boletin` (linkCoherence.cjs) —
// MANTENER EN SYNC. El botón promete un boletín y el enlace no es de NINGUNO: punto ciego de
// los dos checks anteriores, que exigían reconocer un boletín en la URL para hablar.
const EXT_DOCUMENTO_INLINE = /\.(pdf|docx?|odt|rtf)(\?|$)/i;
const PAGINA_INDICE_INLINE = /\/(index|inicio|home|portada)\.(html?|jsp|php|aspx)$/i;
const IDIOMA_EXTRANJERO_INLINE = /\/(en|fr|de|it|pt)(\/|$)/i;
const RUTA_TEMARIO_INLINE = /temario|temari|programa[-_ ]?(?:de[-_ ]?)?(?:materias|oficial)/i;
const ANIO_SUELTO_INLINE = /\b(?:19|20)\d{2}\b/g;
// Estados con convocatoria PUBLICADA (mirror de ESTADOS_FICHA_VIVA de seguimientoUrlSalud.cjs):
// solo entonces existe un documento oficial que enlazar y el hueco es indefendible (error).
const ESTADOS_FICHA_VIVA_INLINE = new Set([
  'convocatoria_publicada',
  'convocada',
  'inscripcion_abierta',
  'inscripcion_cerrada',
  'lista_admitidos',
  'pendiente_examen',
]);

function señalesDeUrlInline(raw: string | null | undefined) {
  const sinEsquema = String(raw || '').replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const corte = sinEsquema.search(/[/?]/);
  let ruta = corte >= 0 ? sinEsquema.slice(corte) : '';
  try {
    ruta = decodeURIComponent(ruta);
  } catch {
    /* ruta con % suelto: se usa tal cual */
  }
  const soloRuta = ruta.split('?')[0];
  const esDocumento = EXT_DOCUMENTO_INLINE.test(soloRuta);
  const tieneId = /\d{3,}/.test(ruta.replace(ANIO_SUELTO_INLINE, ''));
  return {
    idiomaExtranjero: IDIOMA_EXTRANJERO_INLINE.test(soloRuta),
    portadaOSeccion: PAGINA_INDICE_INLINE.test(soloRuta) || (!esDocumento && !tieneId),
    pareceTemario: RUTA_TEMARIO_INLINE.test(soloRuta),
  };
}

// Etiqueta comparable: códigos simples ("BOE", "b.o.e."). Las compuestas de la cola larga
// ("BOP Córdoba", "Sede electrónica") devuelven null → no se comparan.
function normalizarEtiquetaBoletinInline(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const limpio = String(raw).trim().toUpperCase().replace(/\./g, '');
  return /^[A-Z]{3,5}$/.test(limpio) ? limpio : null;
}

// Mirror INLINE de lib/convocatoria/seguimientoUrlSalud.cjs — MANTENER EN SYNC.
// seguimiento_url que vigila un ciclo ya cerrado (falso negativo silencioso). Graduado:
// solo la señal LIMPIA (doc de boletín de año viejo) es error; el resto warn (cola de revisión).
const REF_DOC_BOLETIN =
  /\b(?:BOE|BOCYL|BOJA|DOGV|DOCV|DOG|BOPV|BORM|BOA|BOPA|BOCM|BOIB|BON|DOE|BOR|BOC)[-_ ]?[A-Z]?[-_ ]?(20\d\d)\b/i;
const ANIO_SUELTO = /\b(20\d\d)\b/g;
const URL_GENERICA =
  /\/(?:empleo-?p[uú]blico|emprego|oferta-?de-?empleo(?:-p[uú]blico)?(?:-\d{4}(?:-\d{4})?)?|procesos-?selectivos|convocatorias|recursos-?humanos|tabl[oó]n(?:-oficial)?)\/?$/i;
// Estados con convocatoria PUBLICADA y ficha viva → una URL genérica es ceguera (procesoEnJuego).
// Fuera de aquí (oep_aprobada esperando bases, sin_oep, examen_realizado/nombramientos ya pasados)
// ── Mirror de lib/convocatoria/cifraEnTexto.cjs ──────────────────────────────────────────────────
// El backend no puede importar el `lib/` de la raíz (build aislado), así que lleva su copia. El porqué
// de cada pieza vive en el .cjs; aquí solo el código. La equivalencia entre ambos NO se deja a la buena
// fe: `content-health-sweep.cifra.spec.ts` corre los dos sobre los mismos casos y falla si divergen
// (la paridad de kinds no basta — comparar nombres no compara aritmética).
const U_NUM = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
  'veintisiete', 'veintiocho', 'veintinueve'];
const D_NUM = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const C_NUM = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos',
  'setecientos', 'ochocientos', 'novecientos'];

export function enLetra(n: number): string | null {
  // Fuera del dominio (entero >= 0) devuelve null, no una excepción ni una recursión infinita.
  // El porqué, en el .cjs. Si esto diverge del núcleo, `content-health-sweep.cifra.spec.ts` lo caza.
  if (!Number.isInteger(n) || n < 0) return null;
  if (n < 30) return U_NUM[n];
  if (n < 100) return D_NUM[Math.floor(n / 10)] + (n % 10 ? ` y ${U_NUM[n % 10]}` : '');
  if (n === 100) return 'cien';
  if (n < 1000) return C_NUM[Math.floor(n / 100)] + (n % 100 ? ` ${enLetra(n % 100)}` : '');
  const mil = Math.floor(n / 1000), r = n % 1000;
  return (mil === 1 ? 'mil' : `${enLetra(mil)} mil`) + (r ? ` ${enLetra(r)}` : '');
}

// Frontera del numeral en LETRA. Mirror de lib/convocatoria/cifraEnTexto.cjs; el porqué (los
// numerales se componen, así que «treinta» es palabra entera dentro de «treinta y seis») vive allí.
const PALABRA_NUMERAL = /^(mil|mill[óo]n|millones|cien|ciento|cientos|un|un[oa]|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci(s[ée]is|siete|ocho|nueve)|veinte|veinti(un[oa]?|d[óo]s|tr[ée]s|cuatro|cinco|s[ée]is|siete|ocho|nueve)|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|quinient[oa]s|(dos|tres|cuatro|seis|sete|ocho|nove)cient[oa]s)$/;

function tocaOtroNumeral(vecina: string | undefined, masAlla: string | undefined): boolean {
  if (!vecina) return false;
  if (vecina === 'y') return !!masAlla && PALABRA_NUMERAL.test(masAlla);
  return PALABRA_NUMERAL.test(vecina);
}

// «doscientos puestos» / «doscientas plazas»: enLetra escribe en masculino y el boletín concuerda
// con lo que cuenta. Buscar solo el masculino no da falsos verdes, da acusaciones falsas.
function formasDeGenero(letra: string): string[] {
  const fem = letra
    .replace(/cientos\b/g, 'cientas')
    .replace(/\bveintiuno\b/g, 'veintiuna')
    .replace(/\buno\b/g, 'una');
  return fem === letra ? [letra] : [letra, fem];
}

function numeralSuelto(t: string, letra: string): boolean {
  const palabras = t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const buscada = letra.split(' ');
  for (let i = 0; i + buscada.length <= palabras.length; i++) {
    if (buscada.some((w, k) => palabras[i + k] !== w)) continue;
    const fin = i + buscada.length;
    if (tocaOtroNumeral(palabras[i - 1], palabras[i - 2])) continue;
    if (tocaOtroNumeral(palabras[fin], palabras[fin + 1])) continue;
    return true;
  }
  return false;
}

export function cifraEnTexto(n: number | null | undefined, texto: string | null | undefined): boolean {
  if (n == null) return true;
  // Basura → false, nunca excepción: un detector que revienta deja de reportar (ver el .cjs).
  if (!Number.isInteger(n) || n < 0) return false;
  if (!texto) return false;
  const t = ' ' + String(texto).replace(/\s+/g, ' ').toLowerCase() + ' ';
  // Frontera en los DOS caminos: en dígitos «216» dentro de `C1.1000197163216` no prueba nada
  // ([T-202]); en letra «treinta» dentro de «treinta y seis» tampoco. El porqué medido, en el .cjs.
  const letra = n <= 9999 ? enLetra(n) : null;
  if (letra && formasDeGenero(letra.toLowerCase()).some((f) => numeralSuelto(t, f))) return true;
  const escapar = (s: string) => s.replace(/[.]/g, '\\.');
  return [String(n), String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')]
    .some((f) => new RegExp(`(?<![\\d.,])${escapar(f)}(?![\\d.,]?\\d)`).test(t));
}

/**
 * ¿Existe un subconjunto (≥2) de `numeros` que sume `objetivo`? Mirror de lib/convocatoria/validarDerivada.cjs.
 * Distingue SUMAR partes que el documento enumera (legítimo) de RESTAR de un total que declara
 * (interpretación disfrazada de aritmética) — ver el porqué y las 4 firmas medidas en el .cjs.
 */
export function sumaDeSubconjunto(objetivo: number, numeros: number[]): number[] | null {
  if (!objetivo || objetivo <= 0) return null;
  const cand = [...new Set(numeros)].filter((n) => n <= objetivo).sort((a, b) => b - a).slice(0, 18);
  const busca = (i: number, resto: number, usados: number[]): number[] | null => {
    if (resto === 0 && usados.length >= 2) return usados;
    if (i >= cand.length || resto < 0) return null;
    return busca(i + 1, resto - cand[i], [...usados, cand[i]]) || busca(i + 1, resto, usados);
  };
  return busca(0, objetivo, []);
}

/** ¿Se sostiene sola una firma `cifra_derivada`? Mirror de lib/convocatoria/validarDerivada.cjs. */
export function firmaDerivadaValida(plazas: number | null | undefined, snippet: string | null | undefined): boolean {
  if (plazas == null) return false;
  if (!snippet || !snippet.trim()) return false;
  // Se quita el ruido del boletín (fechas, «núm. N», años sueltos): contarlo inflaba la cita de
  // Extremadura de 7 números a 16 y la guarda la rechazaba siendo legítima. Mirror de numerosDelTexto.
  const limpio = String(snippet)
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ' ')
    .replace(/\bn[úu]m\.?\s*\d+/gi, ' ')
    .replace(/\baño\s+\d{4}\b/gi, ' ');
  const numeros = (limpio.match(/\b\d{1,4}\b/g) || []).map(Number)
    .filter((n) => n > 0).filter((n) => n < 1900 || n > 2100);
  if (numeros.includes(Number(plazas))) return true;    // la cita respalda la cifra directamente
  // Con una cita larga la suma cuadra por azar (medido: 8 números → 24%, 15 → 70%), así que una cita
  // imprecisa no exime. Mirror de MAX_NUMEROS_CITA en lib/convocatoria/validarDerivada.cjs.
  if (new Set(numeros).size > 8) return false;
  return sumaDeSubconjunto(Number(plazas), numeros) !== null;
}

export function esPlazaHuerfana(fila: {
  plazas_libres?: number | null; corpus?: string | null; derivada_declarada?: boolean | null;
  derivada_snippet?: string | null;
}): boolean {
  if (!fila || fila.plazas_libres == null) return false;
  if (!cifraEnTexto(fila.plazas_libres, fila.corpus)) {
    // La válvula solo exime si la firma es VERIFICABLE (endurecido el 27/07: una firma que
    // justificaba una resta no escrita callaba el aviso y publicaba 5 plazas de menos).
    if (fila.derivada_declarada === true) {
      return !firmaDerivadaValida(fila.plazas_libres, fila.derivada_snippet);
    }
    return true;
  }
  return false;
}

// el índice es la vigilancia legítima. Mirror de lib/convocatoria/seguimientoUrlSalud.cjs (T-112).
const ESTADOS_FICHA_VIVA = new Set([
  'convocatoria_publicada',
  'convocada',
  'inscripcion_abierta',
  'inscripcion_cerrada',
  'lista_admitidos',
  'pendiente_examen',
]);
function procesoConFichaViva(estadoProceso: string | null | undefined): boolean {
  return ESTADOS_FICHA_VIVA.has(estadoProceso as string);
}
// ── Mirror INLINE de lib/convocatoria/notaInternaPublicada.cjs — MANTENER EN SYNC ──────────
// Detecta una NOTA INTERNA nuestra colada en un campo que la landing PUBLICA. Los campos de
// referencia se pintan en el hero y bajo el botón oficial; el 31/07/2026 había 7 landings activas
// sirviendo cosas como «⚠️ SIN VERIFICAR: la fila afirma 688 plazas…».
//
// Calibración que sostiene el detector (NO tocar sin re-medir): la referencia LARGA con cita
// literal del boletín es la convención de la casa —mediana 210 caracteres sobre 119 landings
// activas, p90 599— así que marcarla daría 60-90 hallazgos y mataría el badge. Solo se habla ante
// una marca inequívoca de que el texto no se escribió para el usuario.
//
// Paridad de COMPORTAMIENTO vigilada por __tests__/health/notaInternaPublicadaMirror.parity.test.ts.
const NOTA_FAMILIAS: Array<{ tipo: string; re: RegExp }> = [
  {
    tipo: 'duda_publicada',
    re: /\bsin verificar\b|\bno verificable\b|\bno verificad[oa]\b|\bsin confirmar\b|\bpendientes? de verificar\b/i,
  },
  {
    tipo: 'rastro_herramienta',
    re: /\bvia Capa \d|\bsitemap-coverage\b|\bfuente competidor\b|\bcompetidores\b|\boposiciones\.es\b|\bopositatest\b|\bgokoan\b|\bopositas\b/i,
  },
  {
    tipo: 'nota_tecnica',
    re: /\bTODO:|\bFIXME\b|\bREVISAR:|\bOJO:|\bXXX\b|pendiente de identificar|falta identificar|sin identificar|\bno\s+(?:está|estan|están)\s+verificad[oa]s?\b/i,
  },
  { tipo: 'aviso_visual', re: /(⚠️?|🔴|❗|❌)/u },
];
const NOTA_CAMPOS = ['boe_reference', 'diario_referencia', 'convocatoria_numero', 'oep_decreto'];

function clasificarNotasInternas(
  filas: Array<{ slug: string; isActive: boolean; campos: Record<string, string | null> }>,
): { todos: Array<{ slug: string; campo: string; tipo: string; severity: string; extracto: string }> } {
  const todos: Array<{ slug: string; campo: string; tipo: string; severity: string; extracto: string }> = [];
  for (const fila of filas || []) {
    for (const campo of NOTA_CAMPOS) {
      const valor = (fila.campos || {})[campo];
      if (typeof valor !== 'string' || !valor.trim()) continue;
      const fam = NOTA_FAMILIAS.find((f) => f.re.test(valor));
      if (!fam) continue;
      todos.push({
        slug: fila.slug,
        campo,
        tipo: fam.tipo,
        severity: fila.isActive ? 'error' : 'warn',
        extracto: valor.slice(0, 200),
      });
    }
  }
  return { todos };
}

// ── Mirror INLINE de lib/convocatoria/seguimientoVigilable.cjs — MANTENER EN SYNC ──────────
// Decide si una `seguimiento_url` es REALMENTE vigilable por el cron (que hashea el HTML servido
// sin ejecutar JS). Umbrales calibrados el 26/07/2026 sobre las 428 fuentes con HTTP 2xx: solo 15
// bajan de 600 chars de texto y las 15 son defectuosas; la banda 600-1499 es mixta → warn.
// UMBRAL_DUDOSO coincide a propósito con el de `isBlockedPage` en check-seguimiento.
const VIG_UMBRAL_CIEGA = 600;
const VIG_UMBRAL_DUDOSO = 1500;

/** Aplasta el texto (sin acentos, sin espacios, sin `�`) para que los patrones sobrevivan a la
 *  codificación rota de estos portales: "P gina en desuso" == "Página en desuso". */
function aplastarInline(texto: string | null | undefined): string {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/�/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const VIG_PATRONES: Array<{ nivel: string; re: RegExp; motivo: string }> = [
  {
    nivel: 'bloqueo_waf',
    re: /requestrejected|accessdenied|forbidden|youdonthavepermission|requestblocked|captcha|areyouarobot/,
    motivo: 'el servidor responde 200 pero el cuerpo es un bloqueo de WAF, no la página',
  },
  {
    nivel: 'pagina_en_desuso',
    re: /p.?ginaendesuso|estap.?ginahasidotrasladada|accedaatrav.?sdelasiguienteurl/,
    motivo:
      'la propia página declara estar EN DESUSO y remite a otra URL — vigilamos una página muerta',
  },
  {
    nivel: 'redireccion_sin_destino',
    re: /redireccionando|redirigiendo|redirecting/,
    motivo: 'la respuesta es una página de redirección por JS que nunca llega a destino',
  },
  {
    nivel: 'error_aplicacion',
    re: /anerrorhasoccurred|sehaproducidounerror|errorinternodelservidor|internalservererror/,
    motivo: 'el cuerpo es una pantalla de error de la aplicación, no la página de convocatorias',
  },
];

// Patrones de CABECERA (T-165): se evalúan sobre el titular y SIN límite de longitud, porque el
// fallo que atacan es la página de error/login RICA (sirve el portal entero, supera los umbrales
// y pasaba por sana). Mirror de PATRONES_CABECERA_FALSA — el porqué y los casos medidos están en
// lib/convocatoria/seguimientoVigilable.cjs. MANTENER EN SYNC (lo vigila
// __tests__/health/seguimientoVigilableMirror.parity.test.ts, que compara COMPORTAMIENTO).
const VIG_UMBRAL_CABECERA = 220;
const VIG_PATRONES_CABECERA: Array<{ nivel: string; re: RegExp; motivo: string }> = [
  {
    nivel: 'pagina_no_encontrada',
    // + "no hemos podido encontrar la página" (Correos, 27/07/2026): su sitio responde 200
    // con la página de error para CUALQUIER ruta desconocida. Mantener en paridad con
    // lib/convocatoria/seguimientoVigilable.cjs — el test de paridad lo exige.
    re: /noseencontr.?lap.?gina|p.?ginanoencontrada|nohemospodidoencontrarlap.?gina|contenidonoencontrado|pagenotfound|error404|404error/,
    motivo:
      'el TITULAR de la página dice que el contenido no existe: es un 404 servido con 200, ' +
      'nunca listará una convocatoria (y el hash queda congelado para siempre)',
  },
  {
    nivel: 'pagina_error',
    re: /p.?ginadeerror|paginadeerror|errorpage/,
    motivo:
      'el TITULAR de la página es una pantalla de error del portal, no el tablón de convocatorias',
  },
  {
    nivel: 'muro_login',
    re: /servizodeautenticaci|serviciodeautenticaci|identificaci.?ndeusuarios|iniciarsesi.?ncondnie|accesoalportalpuedeacceder/,
    motivo:
      'el TITULAR es un muro de autenticación: el contenido vive detrás del login y el cron ' +
      'solo ve la pantalla de acceso — nunca verá una convocatoria nueva',
  },
  {
    nivel: 'ficha_de_catalogo',
    re: /fichadelcuerpo|fichadeoposici|fichadelaconvocatoria|titulaci.?nrequerida/,
    motivo:
      'el TITULAR es la FICHA de un cuerpo/convocatoria concreta del catálogo, no el listado: ' +
      'describe lo que ya existe y no cambia cuando se convoca un proceso nuevo',
  },
];

function clasificarVigilanciaInline(
  httpStatus: number | null | undefined,
  error: string | null | undefined,
  texto: string | null | undefined,
): { nivel: string; severidad: 'error' | 'warn' | 'ok'; motivo: string } {
  const t = typeof texto === 'string' ? texto.trim() : '';
  const status = typeof httpStatus === 'number' ? httpStatus : 0;
  const httpOk = status >= 200 && status < 300;

  // Fallos RUIDOSOS: ya visibles como seguimiento_change_status='error' → warn, no duplicar.
  if (!httpOk || error) {
    return {
      nivel: 'fetch_error',
      severidad: 'warn',
      motivo: error
        ? `el último check falló (${String(error).slice(0, 60)}) — visible, no silencioso`
        : `el último check devolvió HTTP ${status} — visible, no silencioso`,
    };
  }

  const cabecera = aplastarInline(t.slice(0, VIG_UMBRAL_CABECERA));
  for (const p of VIG_PATRONES_CABECERA) {
    if (p.re.test(cabecera)) {
      return { nivel: p.nivel, severidad: 'error', motivo: p.motivo };
    }
  }

  if (t.length < VIG_UMBRAL_DUDOSO) {
    const aplastado = aplastarInline(t);
    for (const p of VIG_PATRONES) {
      if (p.re.test(aplastado)) {
        return { nivel: p.nivel, severidad: 'error', motivo: p.motivo };
      }
    }
  }

  if (t.length < VIG_UMBRAL_CIEGA) {
    return {
      nivel: 'shell_sin_contenido',
      severidad: 'error',
      motivo:
        `responde 200 pero solo ${t.length} caracteres de texto (umbral ${VIG_UMBRAL_CIEGA}): el contenido ` +
        'se carga por JavaScript y el cron no lo ejecuta → el hash queda congelado y la fuente está ciega',
    };
  }

  if (t.length < VIG_UMBRAL_DUDOSO) {
    return {
      nivel: 'contenido_dudoso',
      severidad: 'warn',
      motivo:
        `responde 200 con ${t.length} caracteres de texto (por debajo de ${VIG_UMBRAL_DUDOSO}): puede ser una ` +
        'página real corta o un contenedor sin contenido — revisar a mano',
    };
  }

  return { nivel: 'ok', severidad: 'ok', motivo: 'contenido suficiente para vigilar' };
}

function diagnosticarSeguimientoUrl(
  url: string | null | undefined,
  anioVigente: number | null | undefined,
  opts?: { procesoEnJuego?: boolean },
): { nivel: string; severidad: 'error' | 'warn' | 'ok'; motivo: string } {
  if (!url) return { nivel: 'ok', severidad: 'ok', motivo: 'sin seguimiento_url' };
  const vig =
    typeof anioVigente === 'number' && Number.isFinite(anioVigente) ? anioVigente : null;
  const doc = url.match(REF_DOC_BOLETIN);
  if (doc && vig && Number(doc[1]) < vig)
    return {
      nivel: 'stale_boletin',
      severidad: 'error',
      motivo: `apunta al documento de boletín ${doc[0]} (${doc[1]}), anterior a la convocatoria vigente (${vig}); un boletín es inmutable y nunca reflejará la nueva`,
    };
  const anios = [...String(url).matchAll(ANIO_SUELTO)].map((m) => Number(m[1]));
  if (vig && anios.length > 0 && !anios.includes(vig) && Math.max(...anios) < vig)
    return {
      nivel: 'posible_ciclo_viejo',
      severidad: 'warn',
      motivo: `la URL menciona ${[...new Set(anios)].join(', ')} pero no ${vig} (convocatoria vigente); revisar si sigue el ciclo correcto`,
    };
  // Índice genérico: solo pinga si el proceso está VIVO en una oposición que vendemos
  // (procesoEnJuego) → nos deja CIEGOS a su convocatoria (caso Murcia) = error accionable. SIN
  // proceso vivo es LEGÍTIMO (para una diputación pequeña el índice puede ser lo único que vigilar)
  // → 'ok', no pinga el badge. Medido 25/07 (T-112): ~14 de 20 seguimiento_url_stale eran
  // url_generica legítimas → sobre-marcado del detector. Mirror de lib/convocatoria/seguimientoUrlSalud.cjs.
  if (URL_GENERICA.test(url)) {
    const enJuego = !!opts?.procesoEnJuego;
    return {
      nivel: 'url_generica',
      severidad: enJuego ? 'error' : 'ok',
      motivo: enJuego
        ? 'la URL es una página índice del portal de empleo, no la ficha de la convocatoria; con el proceso VIVO esto nos deja CIEGOS a sus cambios y a si hay varias convocatorias de la misma OEP — apúntala a la convocatoria concreta'
        : 'la URL es una página índice del portal de empleo (legítima cuando no hay proceso vivo: puede ser lo único que vigilar)',
    };
  }
  return { nivel: 'ok', severidad: 'ok', motivo: 'sin señales de desfase' };
}

/**
 * MIRROR INLINE de `lib/convocatoria/hitoOrigen.js` — MANTENER EN SYNC (T-256, 28/07/2026).
 *
 * `convocatoria_hitos.origen` NO es documentación: el RENDER decide con él (un `registro` se
 * MUESTRA como fecha oficial; una `estimacion` se oculta desde el 20/07). Nadie exigía fuente
 * al escribirlo → 642 de 960 `registro` sin url, sin cita y sin documento. Verificado contra
 * dos fuentes: la landing de Huesca anunciaba un examen el 01/11/2026 que no consta en ningún
 * boletín.
 *
 * La exención por CORROBORACIÓN es la que evita que esto nazca con un 100% de ruido: un cierre
 * de plazo cuya fecha coincide con el `inscription_deadline` verificado no es una fecha
 * inventada — le falta la CITA, no la verdad (provenance, T-147).
 */
const RE_HITO_PREVISION = /previsi[óo]n|pendiente de fecha oficial|estimad[oa]|orientativ[oa]|aproximad[oa]/i;
const RE_HITO_EXAMEN = /ejercicio|examen|prueba/i;

function hitoTieneRespaldo(h: {
  url?: string | null;
  cita_literal?: string | null;
  source_documento_id?: string | null;
}): boolean {
  return Boolean(
    (h.url && String(h.url).trim()) ||
      (h.cita_literal && String(h.cita_literal).trim()) ||
      h.source_documento_id,
  );
}

function mismoDia(a: unknown, b: unknown): boolean {
  const d = (x: unknown) => {
    const f = x instanceof Date ? x : new Date(String(x));
    return Number.isNaN(f.getTime()) ? null : f.toISOString().slice(0, 10);
  };
  const da = d(a);
  return da !== null && da === d(b);
}

/** ¿Este hito se presenta como oficial sin tener con qué sostenerlo? */
function hitoSinFuente(
  h: {
    origen?: string | null;
    titulo?: string | null;
    fecha?: unknown;
    url?: string | null;
    cita_literal?: string | null;
    source_documento_id?: string | null;
  },
  fechaCorroborada?: unknown,
): boolean {
  if (h.origen !== 'registro') return false;
  if (hitoTieneRespaldo(h)) return false;
  if (fechaCorroborada && h.fecha && mismoDia(h.fecha, fechaCorroborada)) return false;
  // El autocontradictorio TAMBIÉN es un hallazgo aquí: el escritor puede degradarlo solo,
  // pero mientras no se haga sigue mostrándose como oficial.
  return true;
}

function hitoEsDeExamen(h: { titulo?: string | null }): boolean {
  return RE_HITO_EXAMEN.test(h.titulo || '');
}

/**
 * MIRROR de `lib/convocatoria/estadoCoherencia.cjs` (el backend es un proyecto aparte y no puede
 * requerir el root `lib/`; mismo motivo por el que `diagnosticarSeguimientoUrl` está replicada
 * aquí arriba). La paridad de KINDS la vigila `__tests__/health/content-sweep-parity.test.ts`;
 * la paridad de COMPORTAMIENTO, `content-health-sweep.estado.spec.ts`, que corre los mismos
 * casos que el test del núcleo. Si tocas una, toca la otra.
 */
export function detectarIncoherenciasEstado(
  o: Record<string, unknown>,
  hoy: string,
): Array<{ severidad: 'error' | 'warn'; regla: string; mensaje: string }> {
  const out: Array<{ severidad: 'error' | 'warn'; regla: string; mensaje: string }> = [];
  // Espejo de la degradación del núcleo (lib/convocatoria/estadoCoherencia.cjs): una oposición NO
  // ACTIVA es ficha de catálogo, no landing servida — su estado puede contradecirse sin que ningún
  // opositor lo lea. Se registra, pero `error` se reserva para lo que está EN PANTALLA. Sin esto,
  // los ~2.500 procesos del catálogo re-llenan la banda de error cada noche al vencer sus plazos.
  // Por defecto NO degrada: solo con `is_active === false` explícito.
  const soloCatalogo = o.is_active === false;
  const add = (severidad: 'error' | 'warn', regla: string, mensaje: string) =>
    out.push({ severidad: soloCatalogo && severidad === 'error' ? 'warn' : severidad, regla, mensaje });
  const dia = (v: unknown) => (v ? String(v).slice(0, 10) : null);

  const e = o.estado_proceso as string | null;
  const dl = dia(o.inscription_deadline);
  const ex = dia(o.exam_date);
  const start = dia(o.inscription_start);
  const abiertaPorFechas = !!start && !!dl && start <= hoy && dl >= hoy;

  if (!e) {
    add('warn', 'estado_vacio', 'estado_proceso vacío');
    return out;
  }
  if (e === 'inscripcion_abierta') {
    if (!dl) add('warn', 'abierta_sin_cierre', "'inscripcion_abierta' SIN fecha de cierre (incompleto/sospechoso de stale)");
    else if (dl < hoy) add('error', 'abierta_plazo_vencido', `'inscripcion_abierta' con plazo VENCIDO (${dl} < ${hoy}) → debe avanzar a inscripcion_cerrada/posterior`);
  }
  if (e === 'convocada' && dl && dl < hoy)
    add('warn', 'convocada_plazo_vencido', `'convocada' pero el plazo de inscripción (${dl}) ya venció → ¿inscripcion_cerrada?`);
  if (e === 'inscripcion_cerrada' && dl && dl > hoy)
    add('warn', 'cerrada_plazo_futuro', `'inscripcion_cerrada' pero el plazo (${dl}) aún no ha vencido (contradicción)`);
  if (e === 'pendiente_examen') {
    if (!ex) add('warn', 'pendiente_sin_fecha', "'pendiente_examen' SIN fecha de examen");
    else if (ex < hoy && !o.exam_date_approximate) add('error', 'pendiente_examen_pasado', `'pendiente_examen' con examen YA PASADO (${ex} < ${hoy}) → debe ser examen_realizado/resultados`);
  }
  if (['examen_realizado', 'resultados', 'nombramientos'].includes(e) && ex && ex > hoy)
    add('error', 'post_examen_futuro', `'${e}' pero el examen es FUTURO (${ex} > ${hoy}) → contradicción`);

  // 5.bis — post-examen mientras la REFERENCIA DE BOLETÍN describe una convocatoria más nueva.
  // Ver el porqué (caso Cádiz, T-211) en lib/convocatoria/estadoCoherencia.cjs; esto es su espejo.
  if (['examen_realizado', 'resultados', 'nombramientos'].includes(e)) {
    const años = String(o.boe_reference ?? '').match(/\b(19|20)\d{2}\b/g);
    const plausibles = (años ?? []).map(Number).filter((a) => a >= 1980 && a <= 2100);
    const anioRef = plausibles.length ? Math.max(...plausibles) : null;
    const pub = dia(o.boe_publication_date);
    const anioEx = ex ? Number(ex.slice(0, 4)) : null;
    if (pub && ex && pub > ex) {
      add('error', 'post_examen_convocatoria_posterior',
        `'${e}' pero la convocatoria se publicó DESPUÉS del examen (${pub} > ${ex}) → la referencia describe otro ciclo, o el estado se quedó viejo`);
    } else if (!ex && anioRef != null && anioRef >= Number(hoy.slice(0, 4))) {
      add('warn', 'post_examen_sin_fecha_ref_actual',
        `'${e}' SIN fecha de examen y con una referencia de boletín de ${anioRef} (${String(o.boe_reference).slice(0, 80)}) → parece una convocatoria NUEVA presentada como proceso terminado`);
    } else if (anioEx != null && anioRef != null && anioRef > anioEx) {
      add('warn', 'post_examen_ref_posterior',
        `'${e}' (examen de ${anioEx}) pero su referencia de boletín cita ${anioRef} → ¿la referencia es ya del ciclo siguiente?`);
    }
  }
  if (start && dl && start > dl)
    add('warn', 'start_despues_deadline', `inscription_start (${start}) posterior al deadline (${dl})`);

  if (o.is_active) {
    if (e === 'inscripcion_abierta' && !abiertaPorFechas) {
      const motivo = !start ? 'sin inscription_start' : !dl ? 'sin deadline' : `plazo vencido (${dl})`;
      add('error', 'abierta_invisible_en_front', `estado 'inscripcion_abierta' pero NO abierta-por-fechas (${motivo}) → invisible en el front`);
    } else if (abiertaPorFechas && e !== 'inscripcion_abierta') {
      add('warn', 'abierta_por_fechas_otro_estado', `abierta-por-fechas pero estado='${e}' → aparece en el front; reconciliar estado`);
    }
  } else if (abiertaPorFechas && !!o.seguimiento_url) {
    if (e !== 'inscripcion_abierta')
      add('warn', 'catalogada_visible_otro_estado', `CATALOGADA visible en el front (abierta) pero estado='${e}' → reconciliar`);
    const lc = dia(o.seguimiento_last_checked);
    if (!lc) add('warn', 'catalogada_sin_verificar', 'CATALOGADA visible en el front pero el radar NUNCA la verificó (seguimiento_last_checked NULL) → fecha sin garantía');
    else {
      const days = Math.floor((Date.parse(hoy) - Date.parse(lc)) / 86400000);
      if (days > 30) add('warn', 'catalogada_radar_stale', `CATALOGADA visible en el front pero el radar no la verifica hace ${days}d (>30) → posible fecha stale`);
    }
  }
  return out;
}

@Injectable()
export class ContentHealthSweepService {
  private readonly logger = new Logger(ContentHealthSweepService.name);
  private readonly base: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    this.base = (
      this.config.get<string>('APP_BASE_URL') || 'https://www.vence.es'
    ).replace(/\/$/, '');
  }

  private async httpOnce(url: string): Promise<number | string> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(url, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': 'vence-health-sweep/1.0' },
      });
      clearTimeout(t);
      return r.status;
    } catch (e) {
      return `ERR(${(e as Error)?.name || 'fetch'})`;
    }
  }
  private async httpStatus(url: string): Promise<number | string> {
    const a = await this.httpOnce(url);
    if (a === 200) return a;
    await new Promise((r) => setTimeout(r, 1200));
    return this.httpOnce(url);
  }

  async run(): Promise<SweepSummary> {
    const now = new Date();
    const stamp = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    const isMonday =
      now.getUTCDay() === 1 || process.env.FORCE_CONTENT_EMAIL === '1';
    const NO_WRITE = process.env.NO_WRITE === '1';

    const F: Finding[] = [];
    const add = (
      category: Finding['category'],
      severity: Finding['severity'],
      slug: string | null,
      kind: string,
      message: string,
      detail?: Record<string, unknown> | null,
    ) =>
      F.push({
        category,
        severity,
        slug,
        kind,
        message,
        detail: detail || null,
      });

    // Latido de lo EVALUADO (T-529): kind → nº de sujetos mirados esta pasada, con
    // hallazgos o sin ellos. Vive fuera de `detectarTodo` para que sobreviva a un
    // `catch` (T-307): si el barrido se corta a mitad, aquí quedan los kinds que SÍ
    // llegaron a completar su bloque antes del corte.
    const kindsEvaluados: Record<string, number> = {};
    const marcar = (kind: string, n: number) => {
      kindsEvaluados[kind] = (kindsEvaluados[kind] ?? 0) + n;
    };

    // ── Detección: AISLADA del resto (T-307, 30/07/2026) ──
    // El 29 y el 30/07 el barrido murió entero porque UN detector (la query de notas de
    // auditoría) superó el `statement_timeout` de 30 s: el throw se llevó por delante a los
    // ~40 restantes Y al bloque de escritura, así que `content_health_findings` se quedó con el
    // snapshot del 28/07 y el panel lo enseñó como si fuera de hoy. Dos días de ceguera sin una
    // sola señal visible en el sitio donde se mira.
    //
    // Con el try/catch aquí, un detector que revienta ya no es un apagón: se escriben los
    // hallazgos recogidos HASTA ese punto y se añade uno propio (`sweep_incompleto`, app/error)
    // que dice que la foto está a medias y por qué. El `cron_run` en error se sigue emitiendo
    // (lo hace el cron), así que la observabilidad no pierde nada: gana el panel.
    //
    // Por qué no un try/catch por detector: son ~45 bloques inline en secuencia; envolverlos uno
    // a uno es un refactor de otra escala y con más riesgo que el fallo que arregla. Esto corta
    // el daño (de "cero datos y verde" a "datos parciales y rojo explícito") sin tocar ni un
    // detector. El aislamiento fino queda anotado en la ficha, no fingido aquí.
    let incompleto: { mensaje: string; sql: string | null } | null = null;
    try {
      await this.detectarTodo(add, marcar, now);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // El error de postgres.js trae la query que falló: es lo que identifica al detector.
      const m = msg.match(/Failed query:\s*([\s\S]{0,400})/);
      incompleto = { mensaje: msg.slice(0, 300), sql: m ? m[1].trim().slice(0, 300) : null };
      this.logger.error(`barrido INCOMPLETO: ${msg.slice(0, 300)}`);
      add(
        'app',
        'error',
        null,
        'sweep_incompleto',
        `el barrido se cortó a mitad: solo ${F.length} hallazgo(s) de esta pasada son fiables — el resto de detectores NO llegaron a correr`,
        {
          hallazgosAntesDelCorte: F.length,
          error: incompleto.mensaje,
          queryQueFallo: incompleto.sql,
        },
      );
    }

    // ── Escribir snapshot ──
    //
    // NO es un TRUNCATE de la tabla entera (arreglado T-455, 07/08/2026): otras herramientas
    // ON-DEMAND (p.ej. `audit-oposicion-completa.ts`, kind oposicion_incompleta) escriben en
    // esta MISMA tabla fuera de este barrido, y un TRUNCATE incondicional se las llevaba por
    // delante cada noche sin que este barrido las volviera a comprobar — la publicación de
    // T-455 sobrevivía como mucho hasta el siguiente tick del @Cron (07:30 UTC), no hasta que
    // el problema se arreglara. Medido en vivo (07/08): `content_health_findings` tenía 0 filas
    // kind oposicion_incompleta (sin comillas) mientras las demás ~37 kinds databan `computed_at` de la
    // pasada de la noche anterior — el barrido las había borrado y nada las repuso. Ahora solo
    // se borran los kinds que ESTA pasada evaluó de verdad (`kindsEvaluados`, el mismo objeto
    // del latido de T-529): un kind ajeno al barrido nunca se toca, y un barrido `sweep_incompleto`
    // (T-307) tampoco arrasa los kinds que no llegó a evaluar.
    let wrote = false;
    if (!NO_WRITE) {
      const kindsDeEstaPasada = Object.keys(kindsEvaluados);
      if (kindsDeEstaPasada.length) {
        await this.db.execute(sql`DELETE FROM content_health_findings WHERE kind = ANY(${pgTextArray(kindsDeEstaPasada)})`);
      }
      for (const f of F) {
        const detailJson = f.detail ? JSON.stringify(f.detail) : null;
        await this.db.execute(sql`
          INSERT INTO content_health_findings (category, severity, oposicion_slug, kind, message, detail)
          VALUES (${f.category}, ${f.severity}, ${f.slug}, ${f.kind}, ${f.message}, ${detailJson}::jsonb)
        `);
      }
      wrote = true;
      this.logger.log(
        `✅ ${stamp} — ${F.length} hallazgos escritos (app err=${F.filter((x) => x.category === 'app' && x.severity === 'error').length}, content err=${F.filter((x) => x.category === 'content' && x.severity === 'error').length}, content warn=${F.filter((x) => x.category === 'content' && x.severity === 'warn').length})`,
      );
    }

    // ── Emails ──
    const emailsSent = await this.sendEmails(F, stamp, isMonday);

    return {
      total: F.length,
      appError: F.filter((x) => x.category === 'app' && x.severity === 'error')
        .length,
      contentError: F.filter(
        (x) => x.category === 'content' && x.severity === 'error',
      ).length,
      contentWarn: F.filter(
        (x) => x.category === 'content' && x.severity === 'warn',
      ).length,
      wrote,
      emailsSent,
      incompleto,
      kindsEvaluados,
    };
  }

  /**
   * Todos los detectores, en secuencia. Vive aparte de `run()` para que `run()` pueda aislar el
   * fallo de uno y conservar lo ya recogido (T-307). No escribe nada: solo llena `F` vía `add`.
   */
  private async detectarTodo(
    add: (
      category: Finding['category'],
      severity: Finding['severity'],
      slug: string | null,
      kind: string,
      message: string,
      detail?: Record<string, unknown> | null,
    ) => void,
    marcar: (kind: string, n: number) => void,
    now: Date,
  ): Promise<void> {
    const opos = (await this.db.execute(sql`
      SELECT id, slug, landing_estadisticas, temas_count FROM oposiciones WHERE is_active = true ORDER BY slug
    `)) as unknown as Array<{
      id: string;
      slug: string;
      landing_estadisticas: unknown;
      temas_count: number | null;
    }>;

    for (const o of opos) {
      const pt = o.slug.replace(/-/g, '_');
      // ── APP: HTTP ──
      const [land, tema, test] = await Promise.all([
        this.httpStatus(`${this.base}/${o.slug}`),
        this.httpStatus(`${this.base}/${o.slug}/temario`),
        this.httpStatus(`${this.base}/${o.slug}/test`),
      ]);
      if (land !== 200)
        add(
          'app',
          'error',
          o.slug,
          'http_down',
          `landing /${o.slug} → ${land}`,
        );
      if (tema !== 200)
        add(
          'app',
          'error',
          o.slug,
          'http_down',
          `/${o.slug}/temario → ${tema}`,
        );
      if (test !== 200)
        add('app', 'error', o.slug, 'http_down', `/${o.slug}/test → ${test}`);
      marcar('http_down', 3);
      // ── APP: cobertura (MV, misma fuente que la app) ──
      // `tp.is_active` NO estaba y daba VERDE FALSO en la tarjeta de temas (T-384): un topic
      // desactivado no existe para el opositor pero contaba igual, así que una landing que promete
      // 120 temas y sirve 20 cuadraba. Gemelo de scripts/health-sweep.cjs (MANTENER EN SYNC).
      const topics = (await this.db.execute(sql`
        SELECT tp.topic_number, tp.disponible, COALESCE(SUM(s.total_questions),0)::int n
        FROM topics tp LEFT JOIN topic_law_question_summary s ON s.topic_id = tp.id
        WHERE tp.position_type = ${pt} AND tp.is_active
        GROUP BY tp.topic_number, tp.disponible
      `)) as unknown as Array<{
        topic_number: number;
        disponible: boolean;
        n: number;
      }>;
      const disp = topics.filter((t) => t.disponible);
      marcar('empty_topic', topics.length);
      if (topics.length && disp.length === 0)
        add(
          'app',
          'error',
          o.slug,
          'empty_topic',
          `${o.slug}: 0 temas disponibles (publicado vacío)`,
        );
      const vacios = disp.filter((t) => t.n === 0);
      if (vacios.length)
        add(
          'app',
          'error',
          o.slug,
          'empty_topic',
          `${o.slug}: ${vacios.length} tema(s) disponible(s) SIN preguntas (T${vacios
            .slice(0, 5)
            .map((v) => v.topic_number)
            .join(',T')})`,
        );
      const finos = disp.filter((t) => t.n > 0 && t.n < 6);
      marcar('low_coverage', disp.length);
      if (finos.length)
        add(
          'content',
          'warn',
          o.slug,
          'low_coverage',
          `${o.slug}: ${finos.length} tema(s) con cobertura fina (<6q)`,
        );
      // ── CONTENIDO: hueco OCULTO de cobertura de artículos (caso M, SMS Tema 7,
      // 13/07). Grano más fino que low_coverage: solo temas MAYORMENTE cubiertos a nivel
      // de artículo (≥60%) con ≥4 huecos. Excluye derogados/vacíos y artículos INACTIVOS
      // (a.is_active): un escopado is_active=false NO es "genera preguntas" (puede tenerlas
      // ARTÍCULO SERVIDO MUDO (T-596) — espejo EXACTO del CLI (`scripts/health-sweep.cjs`).
      // El temario pinta cada artículo con su rúbrica y, si no la hay, con un extracto de su
      // contenido (`lib/teoria/encabezadoArticulo`). Queda mudo —número pelado, sin nada que
      // leer— solo si no tiene ninguna de las dos. Nace de que el encabezado colgaba SOLO de
      // `title`, que 13.952 artículos activos (23% del banco) tienen a NULL teniendo el texto
      // guardado: se servían mudos 48 de 62 en un tema y lo destapó un premium, no un detector.
      const mudos = (await this.db.execute(sql`
        SELECT tp.topic_number,
          count(*)::int AS n,
          (array_agg(l.short_name || ' ' || a.article_number ORDER BY (substring(a.article_number from '^[0-9]+'))::int, a.article_number))[1:6] AS ejemplos
        FROM topic_scope ts
        JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active
        JOIN laws l ON l.id = ts.law_id
        JOIN articles a ON a.law_id = ts.law_id AND a.is_active
                       AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
        WHERE tp.position_type = ${pt}
          AND coalesce(btrim(a.title), '') = ''
          AND length(btrim(coalesce(a.content, ''))) = 0
        GROUP BY tp.topic_number
        ORDER BY tp.topic_number
      `)) as unknown as Array<{ topic_number: number; n: number; ejemplos: string[] | null }>;
      if (mudos.length) {
        const totMudos = mudos.reduce((a2, r) => a2 + r.n, 0);
        add(
          'content',
          'warn',
          o.slug,
          'articulo_servido_sin_texto',
          `${o.slug}: ${totMudos} artículo(s) del temario se sirven SIN NADA que leer (ni rúbrica ni texto; p.ej. T${mudos[0].topic_number}: ${(mudos[0].ejemplos || []).join(', ')})`,
          {
            temas: mudos.map((r) => ({
              tema: r.topic_number,
              arts_mudos: r.n,
              ejemplos: r.ejemplos,
            })),
          },
        );
      }
      marcar('articulo_servido_sin_texto', mudos.length);

      // ya) sino servibilidad → lo cubre scope_phantom_article. Partición limpia.
      const sinPreg = (await this.db.execute(sql`
        SELECT topic_number, (n_content - n_cov)::int AS n, ejemplos FROM (
          SELECT tp.topic_number,
            count(*)::int AS n_content,
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::int AS n_cov,
            -- Mirror de SQL_ORDEN_ARTICULO: castear a int reventaría en cuanto entra "6bis".
            (array_agg(l.short_name || ' ' || a.article_number ORDER BY (substring(a.article_number from '^[0-9]+'))::int, a.article_number)
              FILTER (WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)))[1:6] AS ejemplos
          FROM topic_scope ts
          JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active
          JOIN laws l ON l.id = ts.law_id
          -- article_numbers NULL = LA LEY ENTERA (T-451). Espejo EXACTO del CLI: con el unnest de
          -- antes esos scopes desaparecían del detector y el badge no veía el temario escopado por
          -- ley completa. Mismo criterio que articleInScope() y que el planificador de huérfanos.
          JOIN articles a ON a.law_id = ts.law_id AND a.is_active
                         AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
          WHERE tp.position_type = ${pt} AND length(coalesce(a.content,'')) > 40 AND a.content NOT ILIKE '%derogado%'
            -- Mirror INLINE de SQL_UNIVERSO_COBERTURA (lib/generacion/huerfanosPlan.js)
            -- (MANTENER EN SYNC — lo vigila __tests__/health/content-sweep-parity.test.ts).
            -- Incluye la familia de REFORMA (bis/ter/quáter…), que antes era invisible: 163
            -- artículos escopados sirviendo cero preguntas que el badge no podía ver. NO
            -- incluye disposiciones (otras 503, en su mayoría no examinables).
            AND (a.article_number ~ '^[0-9]+$' OR a.article_number ~* '^[0-9]+ ?(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies)$')
          GROUP BY tp.topic_number
          HAVING count(*) >= 4
             AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) < count(*)
             AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::float / count(*) >= 0.6
             AND count(*) - count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) >= 4
        ) t
        ORDER BY topic_number
      `)) as unknown as Array<{ topic_number: number; n: number; ejemplos: string[] | null }>;
      marcar('article_no_coverage', topics.length);
      if (sinPreg.length) {
        const tot = sinPreg.reduce((a2, r) => a2 + r.n, 0);
        add(
          'content',
          'warn',
          o.slug,
          'article_no_coverage',
          `${o.slug}: ${sinPreg.length} tema(s) con artículos del temario SIN preguntas (${tot} arts; p.ej. T${sinPreg[0].topic_number}: ${(sinPreg[0].ejemplos || []).join(', ')})`,
          {
            temas: sinPreg.map((r) => ({
              tema: r.topic_number,
              arts_sin_preguntas: r.n,
              ejemplos: r.ejemplos,
            })),
          },
        );


      }

      // ── CONTENIDO: banda ciega de cobertura (T-543, 05/08/2026) ──
      // Ni `article_no_coverage` (exige ≥60% cubierto) ni `low_coverage` (exige <6
      // preguntas servidas) ven esta zona: ≥4 huecos, cobertura de artículos <60% y, aun
      // así, un volumen de preguntas servidas donde SÍ se nota al estudiar. Acotado a
      // <=50 (Mirror INLINE de UMBRAL_BANDA_CIEGA de lib/generacion/huerfanosPlan.js —
      // MANTENER EN SYNC, lo vigila __tests__/health/content-sweep-parity.test.ts):
      // calibrado contra RDS el 05/08 — por encima de 50 la mediana de la banda sin
      // acotar es 92 preguntas, y esas no se agotan en una sesión de estudio.
      const bandaCiega = (await this.db.execute(sql`
        SELECT topic_number, n_content, n_cov, (n_content - n_cov)::int AS huerfanos, preguntas, ejemplos FROM (
          SELECT tp.topic_number, tp.id AS topic_id,
            count(*)::int AS n_content,
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::int AS n_cov,
            (array_agg(l.short_name || ' ' || a.article_number ORDER BY (substring(a.article_number from '^[0-9]+'))::int, a.article_number)
              FILTER (WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)))[1:6] AS ejemplos
          FROM topic_scope ts
          JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active AND tp.disponible
          JOIN laws l ON l.id = ts.law_id
          JOIN articles a ON a.law_id = ts.law_id AND a.is_active
                         AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
          WHERE tp.position_type = ${pt} AND length(coalesce(a.content,'')) > 40 AND a.content NOT ILIKE '%derogado%'
            AND (a.article_number ~ '^[0-9]+$' OR a.article_number ~* '^[0-9]+ ?(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies)$')
          GROUP BY tp.topic_number, tp.id
          HAVING count(*) >= 4
             AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) < count(*)
             AND count(*) - count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) >= 4
             AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::float / count(*) < 0.6
        ) t
        JOIN LATERAL (
          SELECT COALESCE(SUM(s.total_questions), 0)::int AS preguntas
            FROM topic_law_question_summary s WHERE s.topic_id = t.topic_id
        ) q ON true
        WHERE q.preguntas BETWEEN 6 AND 50
        ORDER BY q.preguntas ASC, topic_number
      `)) as unknown as Array<{
        topic_number: number;
        n_content: number;
        n_cov: number;
        huerfanos: number;
        preguntas: number;
        ejemplos: string[] | null;
      }>;
      if (bandaCiega.length) {
        const totBanda = bandaCiega.reduce((a2, r) => a2 + Number(r.huerfanos), 0);
        add(
          'content',
          'warn',
          o.slug,
          'cobertura_banda_ciega',
          `${o.slug}: ${bandaCiega.length} tema(s) con cobertura de artículos <60% y pocas preguntas para notarlo (${totBanda} arts sin cubrir; p.ej. T${bandaCiega[0].topic_number}: ${bandaCiega[0].preguntas} preg, ${(bandaCiega[0].ejemplos || []).join(', ')})`,
          {
            temas: bandaCiega.map((r) => ({
              tema: r.topic_number,
              preguntas: r.preguntas,
              arts_sin_preguntas: r.huerfanos,
              ejemplos: r.ejemplos,
            })),
          },
        );
      }
      // El bloque TERMINÓ de mirar su población: un 0 aquí es «vigilado y limpio», no «nadie miró».
      marcar('cobertura_banda_ciega', bandaCiega.length);

      // ── CONTENIDO: coherencia de tarjetas + dual-write + hitos ──
      const nTopics = topics.length;
      if (o.temas_count != null && Number(o.temas_count) !== nTopics)
        add(
          'content',
          'error',
          o.slug,
          'temas_card',
          `temas_count=${o.temas_count} ≠ ${nTopics} topics reales`,
        );
      // Espejo del CLI (T-142): una tarjeta que habla del programa OFICIAL no se compara con los
      // topics servidos — pueden diferir legítimamente (45 del Anexo I + 1 bloque de apoyo).
      const temaCards = cardsAbout(o.landing_estadisticas, 'tema');
      for (const card of temaCards) {
        if (/oficial|programa/i.test(String(card.texto || ''))) continue;
        const v = cardInt(card.numero);
        if (v != null && v !== nTopics)
          add(
            'content',
            'error',
            o.slug,
            'temas_card',
            `tarjeta "${card.texto}"=${v} pero hay ${nTopics} topics`,
          );
      }
      marcar('temas_card', 1 + temaCards.length);
      const convRows = (await this.db.execute(sql`
        SELECT plazas_libres, plazas_discapacidad, plazas_promocion_interna, plazas_otros_turnos, estado_proceso, boe_reference, programa_url, examen_config, landing_faqs, landing_estadisticas, landing_description
        FROM convocatorias WHERE oposicion_id = ${o.id} AND is_current = true LIMIT 1
      `)) as unknown as Array<Record<string, unknown>>;
      const conv = convRows[0];
      if (conv) {
        const L = Number(conv.plazas_libres || 0),
          D = Number(conv.plazas_discapacidad || 0),
          P = Number(conv.plazas_promocion_interna || 0);
        // plazas_otros_turnos es jsonb: array [{turno, plazas, ...}] con reservas
        // especiales (violencia de género, terrorismo, personas trans…) que forman
        // parte del total pero NO son libre/discapacidad/PI. Sin sumarlas, el total
        // de la tarjeta (p.ej. 144 = 139 libre + 5 reservas) se marca en falso.
        const otros = conv.plazas_otros_turnos;
        const O = Array.isArray(otros)
          ? otros.reduce(
              (a: number, t) =>
                a + Number((t as { plazas?: unknown })?.plazas || 0),
              0,
            )
          : 0;
        const valid = new Set(
          [L, D, P, L + D, L + P, D + P, L + D + P, L + D + P + O].filter(
            (x) => x > 0,
          ),
        );
        const plazaCards = cardsAbout(o.landing_estadisticas, 'plaza');
        for (const card of plazaCards) {
          const v = cardInt(card.numero);
          if (v != null && !valid.has(v))
            add(
              'content',
              'error',
              o.slug,
              'plaza_card',
              `tarjeta "${card.texto}"=${v} no cuadra con conv (L=${L} D=${D} P=${P} O=${O})`,
            );
        }
        marcar('plaza_card', plazaCards.length);
        const faltan = [
          'boe_reference',
          'programa_url',
          'examen_config',
          'landing_faqs',
          'landing_estadisticas',
          'landing_description',
        ].filter((k) => conv[k] == null);
        if (faltan.length)
          add(
            'content',
            'warn',
            o.slug,
            'dual_write',
            `dual-write convocatoria incompleto: ${faltan.join(', ')}`,
          );
        marcar('dual_write', 1);
        if (conv.estado_proceso === 'inscripcion_abierta') {
          const hRows = (await this.db.execute(sql`
            SELECT COUNT(*)::int n FROM convocatoria_hitos WHERE oposicion_id = ${o.id}
          `)) as unknown as Array<{ n: number }>;
          if (Number(hRows[0].n) === 0)
            add(
              'content',
              'error',
              o.slug,
              'no_hitos',
              `${o.slug}: inscripción abierta pero 0 hitos (timeline vacío)`,
            );
          marcar('no_hitos', 1);
        }
      }
    }

    // ── Techo de timeout: ¿lento, o chocando contra un corte? (T-315) ──
    //
    // ⚠️ VA FUERA DEL BUCLE POR OPOSICIÓN, y no es un detalle de estilo (31/07/2026). Nació
    // DENTRO —peor: dentro del `if` de otro detector— y, como no depende de la oposición que se
    // esté recorriendo (mira los endpoints de toda la app), se ejecutaba ~123 veces para calcular
    // 123 veces lo mismo. Medido por las dos sesiones que lo encontraron a la vez: 8 endpoints
    // entran en el bucle interno y el peor tarda 9,2 s, así que una vuelta costaba ~74 s por cada
    // oposición activa; el barrido del 31/07 llevaba 47 minutos sin terminar (su marca son 90 s).
    // Y el coste era casi invisible: las vueltas que SÍ terminaban no dejan rastro, y las que
    // agotaban el `statement_timeout` sólo escribían un `warn` AL LOG, que no mira ni el panel ni
    // las alertas.
    //
    // ⚠️ ESPEJO de `lib/observability/techoTimeout.cjs`. El backend no puede importarlo (su Docker
    // solo copia backend/src). Los detectores de latencia miran la MAGNITUD y un timeout da la
    // misma que una lentitud real; lo que los separa es la FORMA de la cola: la lentitud adelgaza,
    // el timeout se amontona justo antes del corte y se acaba en seco.
    //
    // UNA SOLA PASADA para todos los endpoints y todas las bandas (T-361): antes eran 1 consulta
    // + otra POR ENDPOINT con 6 subconsultas correlacionadas. Con `observable_events` en 10,5 M de
    // filas, el filtro selecciona ~1.081 filas y tardaba 117 s en encontrarlas — se escanean
    // millones para quedarse con mil. Por eso el arreglo de verdad es el ÍNDICE PARCIAL de
    // `supabase/migrations/20260731_observable_events_indice_peticiones_lentas.sql`: **sin él, aun
    // en una sola pasada la consulta tarda 55 s y no cabe en el techo de 30 s del pool**, así que
    // el detector seguiría mudo sin que nada fallara.
    const BANDAS: ReadonlyArray<readonly [number, number]> = [
      [5000, 10000], [10000, 20000], [20000, 24000], [24000, 26000], [26000, 60000], [60000, 600000],
    ];
    try {
      const filas = (await this.db.execute(sql`
        SELECT endpoint,
               count(*) FILTER (WHERE duration_ms >= 5000  AND duration_ms < 10000)::int  b0,
               count(*) FILTER (WHERE duration_ms >= 10000 AND duration_ms < 20000)::int  b1,
               count(*) FILTER (WHERE duration_ms >= 20000 AND duration_ms < 24000)::int  b2,
               count(*) FILTER (WHERE duration_ms >= 24000 AND duration_ms < 26000)::int  b3,
               count(*) FILTER (WHERE duration_ms >= 26000 AND duration_ms < 60000)::int  b4,
               count(*) FILTER (WHERE duration_ms >= 60000 AND duration_ms < 600000)::int b5
          FROM observable_events
         WHERE event_type = 'request_completed' AND duration_ms > 5000
           AND created_at > now() - interval '14 days' AND endpoint IS NOT NULL
         GROUP BY endpoint HAVING count(*) >= 20
      `)) as unknown as Array<Record<string, unknown>>;
      for (const fila of (Array.isArray(filas) ? filas : [])) {
        const endpoint = String(fila.endpoint);
        const t = BANDAS.map(([lo, hi], i) => ({ desdeMs: lo, hastaMs: hi, n: Number(fila[`b${i}`] ?? 0) }));
        // DENSIDAD (peticiones por segundo de ancho), no cuenta bruta: los tramos no miden lo mismo.
        // Y la referencia es el tramo anterior CON DATOS — si está vacío, cualquier densidad da «×∞»
        // y un hueco se lee como un muro. Medido el 30/07: con cuentas salían 4 techos y solo 2 eran
        // ciertos (theme-stats y la ruta del PDF eran colas naturales).
        const dens = t.map((x) => x.n / ((x.hastaMs - x.desdeMs) / 1000));
        for (let i = 1; i < t.length - 1; i++) {
          const porEncima = t.slice(i + 1).reduce((a, x) => a + x.n, 0);
          let ref = -1;
          for (let k = i - 1; k >= 0; k--) { if (t[k].n > 0) { ref = k; break } }
          if (ref >= 0 && dens[i] > dens[ref] && t[i].n >= 8 && porEncima <= Math.max(1, Math.floor(t[i].n * 0.1))) {
            add('app', 'warn', null, 'latencia_techo_timeout',
              `\`${endpoint}\` NO va lento: choca contra un TECHO de ~${Math.round(t[i].hastaMs / 1000)} s — ${t[i].n} peticiones entre ${t[i].desdeMs} y ${t[i].hastaMs} ms, la densidad se multiplica ×${(dens[i] / dens[ref]).toFixed(1)} y por encima solo quedan ${porEncima}`,
              { endpoint, techoMs: t[i].hastaMs, enTecho: t[i].n, porEncima });
            break;
          }
        }
      }
      marcar('latencia_techo_timeout', filas.length);
    } catch (e) {
      this.logger.warn(`techo de timeout no evaluado: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    }

    // ── APP: observable_events críticos 24h ──
    const CRIT = ['server_render_error', 'http_5xx', 'webhook_unhealthy'];
    const obs = (await this.db.execute(sql`
      SELECT event_type, endpoint, COUNT(*)::int n, MAX(error_message) sample FROM observable_events
      WHERE severity='error' AND event_type IN ${CRIT} AND ts > now() - interval '24 hours'
      GROUP BY event_type, endpoint ORDER BY n DESC LIMIT 25
    `)) as unknown as Array<{
      event_type: string;
      endpoint: string;
      n: number;
      sample: string | null;
    }>;
    for (const ev of obs)
      add(
        'app',
        'error',
        null,
        ev.event_type,
        `${ev.n}× ${ev.event_type} @ ${ev.endpoint}${ev.sample ? ' — ' + ev.sample.slice(0, 80) : ''}`,
        { n: ev.n },
      );
    for (const k of CRIT)
      marcar(k, obs.filter((ev) => ev.event_type === k).reduce((a, ev) => a + ev.n, 0));

    // ── CONTENIDO: tablas APLANADAS (importadas de PDF sin rejilla) ──
    const flat: Array<{
      slug: string;
      an: string;
      aid: string;
      n: number;
      cells: string[];
    }> = [];
    let flatEscaneados = 0;
    for (let off = 0; off <= 60000; off += 4000) {
      const rows = (await this.db.execute(sql`
        SELECT l.slug, a.id aid, a.article_number an, a.content
        FROM articles a JOIN laws l ON a.law_id = l.id
        WHERE a.is_active AND l.is_active AND position('<' in a.content) = 0 AND length(a.content) > 200 AND a.article_number ~ '^[0-9]+$'
        ORDER BY a.id LIMIT 4000 OFFSET ${off}
      `)) as unknown as Array<{
        slug: string;
        aid: string;
        an: string;
        content: string;
      }>;
      if (!rows.length) break;
      flatEscaneados += rows.length;
      for (const r of rows) {
        const cells = detectFlattenedTable(r.content);
        if (cells)
          flat.push({
            slug: r.slug,
            an: r.an,
            aid: r.aid,
            n: cells.length,
            cells: cells.slice(0, 6),
          });
      }
    }
    marcar('flattened_table', flatEscaneados);
    if (flat.length) {
      const leyes = [...new Set(flat.map((f) => f.slug))];
      add(
        'content',
        'warn',
        null,
        'flattened_table',
        `${flat.length} artículo(s) con tabla aplanada (import PDF sin rejilla) en ${leyes.length} leyes — arreglo por datos con verificación`,
        { count: flat.length, laws: leyes.length, sample: flat.slice(0, 15) },
      );
    }

    // ── CONTENIDO: explicaciones que son NOTAS DE AUDITORÍA ──
    // Mirror INLINE de lib/health/auditNoteExplanation.cjs (MANTENER EN SYNC — el guardarraíl
    // content-sweep-parity compara esta lista con la del núcleo POR VALOR). El backend no puede
    // requerir el `lib/` del frontend: proyecto y build separados.
    //
    // Ampliada el 28/07/2026 tras encontrar el detector EN VERDE con 24 activas defectuosas: los
    // 10 literales originales venían de una remesa concreta de julio y no cubrían las otras
    // formas del mismo acto (la explicación se juzga a sí misma, o da instrucciones de arreglo).
    //
    // Y el 28/07/2026 se le añadió el PATRÓN META (`AUDIT_NOTE_META_RE_SRC`), porque la lista
    // ampliada volvió a quedarse en verde: 96 activas cuya explicación se juzga a sí misma y
    // CERO vistas por los 21 literales. Los literales cubren las notas con otro sujeto ("Esta
    // pregunta debería", "Nota técnica:"); el patrón cubre el acto. Van en OR.
    // El acto de EDITAR (29/07/2026, T-262 → impugnación 278f993d): la nota en infinitivo que
    // ordena añadir una sección, guardada tal cual como explicación. Va ANCLADA al principio; sin
    // el ancla, «…añadir secciones y modificar propiedades…» (Access) daba falso positivo.
    // MANTENER IDÉNTICO a `lib/health/auditNoteExplanation.cjs` (lo vigila content-sweep-parity).
    const AUDIT_NOTE_ACTO_RE_SRC =
      '^\\s*(\\*\\*)?\\s*(a[ñn]adir|incluir|reescribir|sustituir|completar|corregir)\\s+(la\\s+)?secci[oó]n';
    const AUDIT_NOTE_META_RE_SRC =
      'la explicaci[oó]n\\s+(es|no|debe|deber|de la respuesta|del enunciado|dada|actual|original|' +
      'proporcionada|aportada|ofrecida|resulta|contiene|confunde|omite|menciona|cita|se refiere|est[aá])';
    const AUDIT_NOTE_PATS = [
      'La explicación omite',
      'La explicación debería',
      'La explicación actual',
      'Esta pregunta debería',
      'posible errata',
      'Nota técnica:',
      'respuesta oficial del examen',
      'debería ser impugnada',
      'debería haberse ANULADO',
      'debería haber especificado',
      'La explicación confunde',
      'La explicación proporcionada',
      'La explicación es incorrecta',
      'La explicación menciona',
      'La explicación solo menciona',
      'La explicación no debe',
      'la explicación debe precisar',
      'La explanation',
      'Debe reescribirse',
      'Debe reorientarse',
      'Corregir eliminando',
      'conviene aclarar este matiz',
      'por razones bien explicadas',
    ];
    // Los literales van FUNDIDOS en UNA alternancia, no como 23 `ILIKE` con OR (T-307, 30/07/2026):
    // así costaban 38 de los 40,6 s de la query y reventaban el `statement_timeout` de 30 s,
    // tumbando el barrido COMPLETO dos noches seguidas. Fundidos: 6,6 s y el mismo conjunto de
    // resultados (medido sin LIMIT sobre las 159.671 filas). El razonamiento entero, y por qué el
    // `LIMIT 50` lo tuvo escondido hasta que se limpió el cubo, está en el núcleo.
    // MANTENER IDÉNTICO a `AUDIT_NOTE_LITERAL_RE_SRC` de `lib/health/auditNoteExplanation.cjs`
    // (el guardarraíl content-sweep-parity compara el VALOR, no el texto).
    const escaparLiteralRe = (s: string) =>
      String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const AUDIT_NOTE_LITERAL_RE_SRC =
      '(' + AUDIT_NOTE_PATS.map(escaparLiteralRe).join('|') + ')';
    const anRows = (await this.db.execute(sql`
      SELECT id FROM questions
       WHERE is_active = true
         AND (explanation ~* ${AUDIT_NOTE_LITERAL_RE_SRC}
              OR explanation ~* ${AUDIT_NOTE_META_RE_SRC}
              OR explanation ~* ${AUDIT_NOTE_ACTO_RE_SRC})
       LIMIT 50
    `)) as unknown as Array<{ id: string }>;
    if (anRows.length)
      add(
        'content',
        'warn',
        null,
        'audit_note_explanation',
        `${anRows.length}${anRows.length >= 50 ? '+' : ''} pregunta(s) visibles con la explicación = nota de auditoría de un pase IA (reescribir o needs_human)`,
        { count: anRows.length, sample: anRows.slice(0, 15).map((r) => r.id) },
      );
    marcar('audit_note_explanation', anRows.length);

    // ── CONTENIDO: la prosa de auditoría también está DENTRO del temario (T-253) ──
    // Mirror INLINE de lib/health/articleAuditNote.cjs (MANTENER EN SYNC — content-sweep-parity
    // compara el VALOR de ARTICLE_AUDIT_NOTE_RE_SRC_SQL, no el texto). Hermano de
    // audit_note_explanation, un escalón más grave: la nota está en el ARTÍCULO (la teoría que
    // el opositor lee directamente en /temario), no en la explicación de una pregunta suelta.
    // El sujeto "afirmación" es obligatorio a propósito — sin él, "también es incorrecta"
    // (Access 365: una trampa de examen explicada, contenido legítimo) da falso positivo. Y el
    // límite de palabra es `\y`, NO `\b`: en Postgres ARE `\b` no es límite de palabra (medido:
    // `'esta es' ~* '\besta'` → false), así que sin `\y` el patrón casaría "esta" dentro de
    // "respuesta". Detalle y calibración completa (17 artículos, 45 apariciones, 8.410
    // preguntas colgando, medido 06/08/2026) en el núcleo.
    const ARTICLE_AUDIT_NOTE_RE_SRC_SQL =
      '\\y(esa|esta|dicha|tal)\\s+afirmaci[oó]n\\s+(es|resulta)\\s+(\\*\\*)?incorrect';
    const aanRows = (await this.db.execute(sql`
      SELECT a.id FROM articles a JOIN laws l ON l.id = a.law_id
       WHERE a.is_active = true AND l.is_active = true AND a.content ~* ${ARTICLE_AUDIT_NOTE_RE_SRC_SQL}
       LIMIT 50
    `)) as unknown as Array<{ id: string }>;
    if (aanRows.length)
      add(
        'content',
        'warn',
        null,
        'article_audit_note',
        `${aanRows.length}${aanRows.length >= 50 ? '+' : ''} artículo(s) activos con la nota de auditoría incrustada en la TEORÍA (contrastar con la fuente oficial y revisar las preguntas del artículo)`,
        { count: aanRows.length, sample: aanRows.slice(0, 15).map((r) => r.id) },
      );
    marcar('article_audit_note', aanRows.length);

    // ── CONTENIDO: integridad de los PSICOTÉCNICOS ──
    // Gemelo de scripts/health-sweep.cjs (MANTENER EN SYNC — guardarraíl content-sweep-parity).
    // Hueco encontrado al inventariar las suites del job de integración (T-384): el barrido no
    // cubría los psicotécnicos en absoluto, y sus únicas comprobaciones vivían en dos tests de CI
    // que, con ese job mudo, no le decían nada a nadie. Son 7.102 preguntas activas servidas.
    // Los tres invariantes salen de esas suites, no de un criterio nuevo. Medido el 31/07: 0/0/0.
    const psiRows = (await this.db.execute(sql`
      SELECT
        (SELECT count(*) FROM psychometric_questions WHERE is_active)::int AS total_activas,
        (SELECT count(*) FROM psychometric_questions WHERE is_active AND section_id IS NULL)::int AS sin_seccion,
        (SELECT count(*) FROM psychometric_questions q JOIN psychometric_sections s ON s.id = q.section_id
          WHERE q.is_active AND s.category_id <> q.category_id)::int AS seccion_ajena,
        (SELECT count(*) FROM psychometric_questions WHERE is_active
          AND (correct_option IS NULL OR correct_option < 0 OR correct_option > 3))::int AS clave_invalida
    `)) as unknown as Array<{
      total_activas: number
      sin_seccion: number
      seccion_ajena: number
      clave_invalida: number
    }>;
    const psi = psiRows[0] ?? { total_activas: 0, sin_seccion: 0, seccion_ajena: 0, clave_invalida: 0 };
    marcar('psicotecnico_integridad', psi.total_activas);
    {
      const partes: string[] = [];
      if (psi.sin_seccion) partes.push(`${psi.sin_seccion} sin sección (no se sirven)`);
      if (psi.seccion_ajena)
        partes.push(`${psi.seccion_ajena} con sección de otra categoría (los totales mienten)`);
      if (psi.clave_invalida)
        partes.push(`${psi.clave_invalida} con correct_option inválido (no se pueden corregir)`);
      if (partes.length)
        add(
          'content',
          'error',
          null,
          'psicotecnico_integridad',
          `Psicotécnicos con la integridad rota: ${partes.join(' · ')}`,
          {
            sinSeccion: psi.sin_seccion,
            seccionAjena: psi.seccion_ajena,
            claveInvalida: psi.clave_invalida,
          },
        );
    }

    // ── CONTENIDO: dos OPCIONES idénticas dentro de la misma pregunta ──
    // Gemelo de scripts/health-sweep.cjs (MANTENER EN SYNC — guardarraíl content-sweep-parity).
    // Criterio en `lib/health/opcionesDuplicadas.cjs`, que es donde vive con sus tests.
    //
    // Hueco que ningún kind cubría (T-406): todos los detectores de contenido comparan la pregunta
    // con su ARTÍCULO, con el epígrafe o con la convocatoria — ninguno la compara CONSIGO MISMA.
    //
    // La comparación se hace AQUÍ, en JS, y NO en la consulta, a propósito: normalizar en SQL fue
    // lo que inventó los fantasmas. Un `\s+` que llegó como `s+` borraba las eses e igualaba
    // `wardrobes` con `wardrobess` (8 falsos), y `lower()` igualaba opciones que se distinguen
    // justamente por la mayúscula. Lo único que se normaliza es el espacio en blanco.
    //
    // Dos bandas: `error` = la clave está DENTRO del par (se acierta y se falla a la vez) ·
    // `warn` = son dos distractores (resoluble, pero se lee descuido). Medido el 31/07: 33, todas
    // warn y ya reparadas → nace en verde, que es el momento exacto de poner un trinquete.
    const opcRows = (await this.db.execute(sql`
      SELECT id, option_a, option_b, option_c, option_d, correct_option
        FROM questions WHERE is_active
    `)) as unknown as Array<{
      id: string
      option_a: string | null
      option_b: string | null
      option_c: string | null
      option_d: string | null
      correct_option: number | null
    }>;
    {
      const LETRAS = ['A', 'B', 'C', 'D'];
      const norm = (x: string | null): string | null => {
        if (x == null) return null;
        const t = String(x).trim().replace(/\s+/g, ' ');
        return t.length ? t : null;
      };
      const errores: string[] = [];
      const avisos: string[] = [];
      for (const q of opcRows ?? []) {
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d].map(norm);
        for (let i = 0; i < 4; i++) {
          for (let j = i + 1; j < 4; j++) {
            // Una opción vacía NO forma par: si contase, saltaría toda pregunta de tres
            // alternativas (Policía Nacional sirve 989 de 991 oficiales con la D vacía).
            if (opts[i] === null || opts[j] === null) continue;
            if (opts[i] !== opts[j]) continue;
            const etiqueta = `${q.id} (${LETRAS[i]}=${LETRAS[j]})`;
            if (q.correct_option === i || q.correct_option === j) errores.push(etiqueta);
            else avisos.push(etiqueta);
          }
        }
      }
      if (errores.length)
        add(
          'content',
          'error',
          null,
          'opciones_duplicadas',
          `${errores.length} pregunta(s) activas con la CLAVE duplicada en dos opciones: se acierta y se falla a la vez`,
          { count: errores.length, banda: 'clave_en_el_par', sample: errores.slice(0, 15) },
        );
      if (avisos.length)
        add(
          'content',
          'warn',
          null,
          'opciones_duplicadas',
          `${avisos.length} pregunta(s) activas con dos distractores idénticos: se quedan en tres opciones sin decirlo`,
          { count: avisos.length, banda: 'distractores', sample: avisos.slice(0, 15) },
        );
      marcar('opciones_duplicadas', opcRows.length);
    }

    // ── CONTENIDO: preguntas que invocan una imagen/icono AUSENTE (visual deixis sin image_url) ──
    // Gemelo de scripts/health-sweep.cjs (MANTENER EN SYNC — guardarraíl content-sweep-parity).
    // El enunciado apunta a un visual ("el siguiente icono", "observa la figura", "de la imagen…")
    // pero image_url es NULL y content_data va vacío → irresoluble en silencio. VD_FP frena FPs
    // ("imagen corporal/pública", "de la imagen y el sonido", "derecho a la propia imagen"…).
    //
    // ⚠️ MIRROR de `lib/health/visualDeixis.cjs` — este proyecto NestJS no puede importar el
    // `lib/` del frontend (build separado), así que los patrones se replican INLINE y el
    // guardarraíl `content-sweep-parity` los compara con el núcleo POR VALOR: si tocas uno,
    // toca el otro o el test se pone rojo. Toda la calibración (por qué `esquema` no cuenta
    // como visual, por qué la guarda de SQL mira también las opciones, y qué punto ciego se
    // asume) está documentada UNA vez, en el núcleo. Misma convención que
    // canonicalizeBoletinUrl / landingCompleteness.
    const VD_NOUNS =
      'icono|imagen|imágen|s[íi]mbolo|gr[áa]fico|figura|captura|pictograma|diagrama|se[ñn]al';
    const VD_STRONG =
      `(\\y(el|la)\\s+siguiente\\s+(${VD_NOUNS})\\y)` +
      '|(en\\s+la\\s+imagen\\s+(anterior|superior|inferior|adjunt\\w+|siguiente|de\\s+arriba|de\\s+abajo))' +
      '|(\\yla\\s+imagen\\s+(muestra|adjunt\\w+|superior|inferior|siguiente|anterior)\\y)' +
      '|((observa|observe|obsérv\\w+|f[íi]jese\\s+en)\\s+(la|el)\\s+(siguiente\\s+)?(imagen|figura|gr[áa]fico|icono|s[íi]mbolo|captura))' +
      '|(seg[úu]n\\s+(la\\s+imagen|la\\s+figura|el\\s+gr[áa]fico\\s+adjunt|muestra\\s+la\\s+(imagen|figura)|se\\s+muestra\\s+en\\s+la\\s+(imagen|figura)))' +
      '|(¿qu[ée]\\s+(significa|representa|indica)\\s+(este|el\\s+siguiente)\\s+(icono|s[íi]mbolo|pictograma|gr[áa]fico))' +
      '|(\\y(icono|s[íi]mbolo|pictograma|gr[áa]fico|captura|divisa|distintivo|emblema)\\s+(mostrad\\w+|adjunt\\w+|que\\s+se\\s+muestra|siguiente|anterior|de\\s+la\\s+(imagen|figura|fotograf\\w+))\\y)' +
      '|(\\y(restas|celda|celdas|f[óo]rmula|f[óo]rmulas|tabla|query|consulta|marca|base\\s+de\\s+datos|diagrama)\\w*\\s+\\w*\\s*(de|en)\\s+la\\s+imagen\\y)' +
      '|(\\yde\\s+la\\s+imagen[,. ]+(indica|se[ñn]ale|cu[áa]l|obten|calcul))';
    const VD_FP =
      'imagen corporal|imagen p[úu]blica|imagen de la administraci|imagen de las mujeres|' +
      'de la imagen y|imagen y (el |del )?sonido|imagen y sonido|derecho a la propia imagen|' +
      'reproducci[óo]n del sonido|de la imagen o|icono (muestra|con forma|que representa a)|' +
      's[íi]mbolo (¶|de p[áa]rrafo)|figura (jur[íi]dic|del? |profesional)';
    const VD_SQL = '\\yselect\\y.*\\yfrom\\y';
    const vdRows = (await this.db.execute(sql`
      SELECT id, question_text FROM questions
      WHERE is_active = true
        AND (image_url IS NULL OR image_url = '')
        AND (content_data IS NULL OR content_data::text IN ('{}','null',''))
        AND question_text ~* ${VD_STRONG} AND question_text !~* ${VD_FP}
        AND (coalesce(question_text,'') || ' ' || coalesce(option_a,'') || ' ' ||
             coalesce(option_b,'') || ' ' || coalesce(option_c,'') || ' ' ||
             coalesce(option_d,'')) !~* ${VD_SQL}
      LIMIT 60
    `)) as unknown as Array<{ id: string; question_text: string }>;
    if (vdRows.length)
      add(
        'content',
        'warn',
        null,
        'visual_deixis_no_image',
        `${vdRows.length}${vdRows.length >= 60 ? '+' : ''} pregunta(s) visible(s) que invocan un icono/símbolo/imagen SIN imagen almacenada (image_url NULL) — irresolubles; reconstruir la imagen o jubilar (admin_image_unavailable)`,
        {
          count: vdRows.length,
          sample: vdRows.slice(0, 15).map((r) => ({ id: r.id, q: (r.question_text || '').slice(0, 90) })),
        },
      );
    marcar('visual_deixis_no_image', vdRows.length);

    // ── §2.2-quater: enunciado que cita una norma SIN nombrarla (29/07/2026) ──
    // «Según el artículo 75 DE LA LEY, …»: fuera del test no hay forma de saber de qué norma habla.
    // MANTENER IDÉNTICO a `lib/health/autocontenida.cjs` (lo vigila content-sweep-parity POR VALOR).
    // El ancla al «artículo N» no es cosmética: sin ella entra «conforme a la ley» como fórmula
    // jurídica del contenido (medido: 391 → 274 y desaparece esa clase entera de falsos positivos).
    const AC_DESNUDA =
      '\\yart[íi]culo\\s+[0-9]+(\\.[0-9]+)*\\s*(bis|ter|qu[áa]ter)?\\s*' +
      '(,\\s*(p[áa]rrafo|apartado)[^,]{0,20},?\\s*)?' +
      '(de|seg[úu]n)\\s+(la|dicha|esta|citada|presente|mencionada|referida)\\s+' +
      '(normativa|norma|ley|reglamento|disposici[óo]n)\\y' +
      '([,.:;?)]|\\s+(en|se|que|si|no|para|cuando)\\y|$)';
    const AC_IDENTIFICA =
      '([0-9]+/[0-9]{2,4})' +
      '|(\\yconstituci[óo]n\\y)' +
      '|(\\y(universidad|ayuntamiento|ordenanza|estatuto|convenio|tratado)\\y)' +
      '|(\\yley\\s+(de|del|org[áa]nica)\\y)' +
      '|(\\yreglamento\\s+(de|del)\\y)' +
      '|(\\yc[óo]digo\\s+[a-z])';
    // Sensible a mayúsculas A PROPÓSITO: con `~*` casaría dos letras cualesquiera.
    const AC_SIGLA = '[A-ZÁÉÍÓÚÑ]{2,}';
    const acRows = (await this.db.execute(sql`
      SELECT id, question_text FROM questions
      WHERE is_active = true
        AND question_text ~* ${AC_DESNUDA}
        AND NOT (question_text ~* ${AC_IDENTIFICA} OR question_text ~ ${AC_SIGLA})
      LIMIT 60
    `)) as unknown as Array<{ id: string; question_text: string }>;
    if (acRows.length)
      add(
        'content',
        'warn',
        null,
        'enunciado_norma_sin_nombrar',
        `${acRows.length}${acRows.length >= 60 ? '+' : ''} pregunta(s) visible(s) cuyo enunciado cita un artículo «de la ley» sin nombrarla nunca — incumple §2.2-quater (autocontenida); el nombre está en la ley vinculada`,
        {
          count: acRows.length,
          sample: acRows.slice(0, 15).map((r) => ({ id: r.id, q: (r.question_text || '').slice(0, 90) })),
        },
      );
    marcar('enunciado_norma_sin_nombrar', acRows.length);

    // ── CONTENIDO: leyes ANUALES caducadas dentro de un topic_scope ──
    const CURR_YEAR = now.getFullYear();
    const scopedLaws = (await this.db.execute(sql`
      SELECT l.id, l.short_name, l.name,
        (SELECT array_agg(DISTINCT t.position_type ORDER BY t.position_type)
           FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id WHERE ts.law_id = l.id) AS oposiciones
      FROM laws l
      WHERE l.is_active = true AND EXISTS (SELECT 1 FROM topic_scope ts WHERE ts.law_id = l.id)
    `)) as unknown as Array<{
      id: string;
      short_name: string | null;
      name: string | null;
      oposiciones: string[] | null;
    }>;
    for (const l of scopedLaws) {
      const m = (l.name || '').match(TARGET_YEAR_RE);
      const yr = m ? Number(m[1] || m[2]) : null;
      if (yr != null && yr < CURR_YEAR) {
        const opsList = (l.oposiciones || []).filter(Boolean);
        add(
          'content',
          'warn',
          null,
          'stale_dated_law',
          `${l.short_name || l.name} es del año ${yr} (caducada) y sigue en el temario de ${opsList.length} oposición(es) — actualizar a la vigente y generar preguntas`,
          { law_id: l.id, year: yr, oposiciones: opsList },
        );
      }
    }
    marcar('stale_dated_law', scopedLaws.length);

    // ── CONTENIDO: leyes NO verificadas contra su fuente oficial (falso verde) ──
    const lawRows = (await this.db.execute(sql`
      SELECT l.id, l.short_name, l.name, l.scope, l.is_virtual, l.boe_url,
             l.verification_status, l.last_verification_summary AS su,
             EXISTS (SELECT 1 FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
                     WHERE ts.law_id = l.id AND t.disponible) AS serving_live
      FROM laws l
    `)) as unknown as Array<{
      id: string;
      short_name: string | null;
      name: string | null;
      scope: string | null;
      is_virtual: boolean | null;
      boe_url: string | null;
      verification_status: string | null;
      su: VerificationSummary | null;
      serving_live: boolean;
    }>;
    const unverified: Array<{
      id: string;
      name: string | null;
      scope: string | null;
      state: string;
    }> = [];
    for (const l of lawRows) {
      const st = classifyLaw(
        l.is_virtual,
        l.boe_url,
        l.verification_status,
        l.su,
      );
      if (st && l.serving_live)
        unverified.push({
          id: l.id,
          name: l.short_name || l.name,
          scope: l.scope,
          state: st,
        });
    }
    if (unverified.length) {
      const byState = unverified.reduce<Record<string, number>>(
        (a, u) => ((a[u.state] = (a[u.state] || 0) + 1), a),
        {},
      );
      add(
        'content',
        'warn',
        null,
        'law_unverified_source',
        `${unverified.length} ley(es) sirviendo en temas vivos SIN verificar contra su fuente oficial (${Object.entries(
          byState,
        )
          .map(([k, v]) => `${k}:${v}`)
          .join(', ')}) — importadas a medias o falso verde`,
        { count: unverified.length, byState, sample: unverified.slice(0, 20) },
      );
    }
    marcar('law_unverified_source', lawRows.length);

    // ── CONTENIDO: TÍTULOS HUÉRFANOS del temario (hueco INTERNO del topic_scope) ──
    const SCOPE_GAP_MIN_Q = Number(process.env.SCOPE_GAP_MIN_Q || 8);
    const titSecs = (await this.db.execute(sql`
      SELECT ls.law_id, l.short_name, ls.section_number, ls.article_range_start lo, ls.article_range_end hi
      FROM law_sections ls JOIN laws l ON l.id = ls.law_id
      WHERE ls.section_type = 'titulo' AND ls.article_range_start IS NOT NULL AND ls.article_range_end IS NOT NULL
    `)) as unknown as Array<{
      law_id: string;
      short_name: string | null;
      section_number: string;
      lo: number;
      hi: number;
    }>;
    const scopeAll = (await this.db.execute(sql`
      SELECT t.position_type pt, ts.law_id, ts.article_numbers
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id WHERE ts.article_numbers IS NOT NULL AND t.is_active
    `)) as unknown as Array<{
      pt: string;
      law_id: string;
      article_numbers: string[] | null;
    }>;
    const qAll = (await this.db.execute(sql`
      SELECT a.law_id, a.article_number an, count(DISTINCT q.id)::int n
      FROM questions q JOIN articles a ON a.id = q.primary_article_id
      WHERE q.is_active AND a.article_number ~ '^[0-9]+$' GROUP BY a.law_id, a.article_number
    `)) as unknown as Array<{ law_id: string; an: string; n: number }>;
    const scopedByPtLaw = new Map<string, Set<number>>();
    for (const r of scopeAll) {
      const k = r.pt + '|' + r.law_id;
      let set = scopedByPtLaw.get(k);
      if (!set) scopedByPtLaw.set(k, (set = new Set()));
      for (const a of r.article_numbers || []) {
        const n = parseInt(a);
        if (!isNaN(n) && n > 0) set.add(n);
      }
    }
    const qByLawArt = new Map<string, number>();
    for (const r of qAll) qByLawArt.set(r.law_id + '|' + parseInt(r.an), r.n);
    const secsByLaw = new Map<
      string,
      Array<{
        short_name: string | null;
        section_number: string;
        lo: number;
        hi: number;
      }>
    >();
    for (const sc of titSecs) {
      let arr = secsByLaw.get(sc.law_id);
      if (!arr) secsByLaw.set(sc.law_id, (arr = []));
      arr.push(sc);
    }
    const scopeGaps: Array<{
      pt: string;
      ley: string | null;
      titulo: string;
      rango: string;
      preguntas: number;
    }> = [];
    for (const [k, scoped] of scopedByPtLaw) {
      if (scoped.size === 0) continue;
      const bar = k.lastIndexOf('|');
      const pt = k.slice(0, bar);
      const lawId = k.slice(bar + 1);
      const secs = secsByLaw.get(lawId);
      if (!secs) continue;
      const smin = Math.min(...scoped),
        smax = Math.max(...scoped);
      for (const sc of secs) {
        let q = 0,
          anyScoped = false;
        for (let i = sc.lo; i <= sc.hi; i++) {
          q += qByLawArt.get(lawId + '|' + i) || 0;
          if (scoped.has(i)) anyScoped = true;
        }
        if (q >= SCOPE_GAP_MIN_Q && !anyScoped && smin < sc.lo && smax > sc.hi)
          scopeGaps.push({
            pt,
            ley: sc.short_name,
            titulo: sc.section_number,
            rango: `${sc.lo}-${sc.hi}`,
            preguntas: q,
          });
      }
    }
    if (scopeGaps.length) {
      scopeGaps.sort((a, b) => b.preguntas - a.preguntas);
      const nOpos = new Set(scopeGaps.map((g) => g.pt)).size;
      add(
        'content',
        'warn',
        null,
        'scope_titulo_huerfano',
        `${scopeGaps.length} título(s) con preguntas huérfanas (hueco INTERNO del scope) en ${nOpos} oposición(es) — el epígrafe puede pedirlos; adjudicar con verify:scope`,
        {
          count: scopeGaps.length,
          oposiciones: nOpos,
          sample: scopeGaps.slice(0, 20),
        },
      );
    }
    marcar('scope_titulo_huerfano', titSecs.length);

    // ── Incisos anulados por el TC: preguntas activas cuya CLAVE cae en un inciso anulado ──
    // Barato (DB-only, sin red): reusa el gate de T-048 `answer_falls_in_annulled_fragment`
    // sobre las vigencia_notes que el cron semanal `annulled-vigencia-sweep` va poblando (T-009).
    // El gate impide ACTIVAR nuevas; esto SURGE las que ya estaban activas de antes.
    const annulledBugs = (await this.db.execute(sql`
      SELECT l.short_name AS ley, a.article_number AS art,
             count(DISTINCT q.id)::int AS preguntas
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
      WHERE q.is_active AND a.vigencia_notes IS NOT NULL
        AND public.answer_falls_in_annulled_fragment(
          CASE q.correct_option
            WHEN 0 THEN q.option_a WHEN 1 THEN q.option_b
            WHEN 2 THEN q.option_c WHEN 3 THEN q.option_d END,
          a.vigencia_notes) = true
      GROUP BY l.short_name, a.article_number
      ORDER BY count(DISTINCT q.id) DESC
    `)) as unknown as Array<{ ley: string; art: string; preguntas: number }>;
    if (annulledBugs.length) {
      const total = annulledBugs.reduce((s, r) => s + Number(r.preguntas), 0);
      // WARN, no ERROR: el gate (≥60 car. de la clave dentro del inciso) tiene falsos
      // positivos cuando la clave y el inciso anulado comparten la CLÁUSULA INICIAL pero
      // difieren en el fondo (caso LO 4/2000 art 58: "...tres años" anulado vs "...cinco
      // años" vigente). Son CANDIDATOS a revisión humana, no bugs confirmados.
      add(
        'content',
        'warn',
        null,
        'answer_in_annulled_fragment',
        `${total} pregunta(s) activa(s) cuya clave reproduce (≥60 car.) un inciso ANULADO por el TC en ${annulledBugs.length} artículo(s) — CANDIDATO: verificar la clave contra la sentencia (puede ser falso positivo si solo comparten la cláusula inicial; NUNCA auto-flip)`,
        { total, articulos: annulledBugs.length, sample: annulledBugs.slice(0, 20) },
      );
    }
    marcar('answer_in_annulled_fragment', annulledBugs.length);

    // ── CONTENIDO: PROVENANCE de documentos de convocatoria (referenciado sin clonar/enlazar) ──
    // Lee la VISTA convocatoria_docs_coverage (migración 20260721). Un hito cita un
    // BOE/boletín (url + cita_literal) pero ese documento no está clonado en
    // convocatoria_documentos o no está enlazado (source_documento_id). Gap medido
    // 21/07: 18/1044 hitos enlazados, 239 docs referenciados sin clonar. Runbook:
    // docs/runbooks/provenance-convocatorias.md. Gemelo de scripts/health-sweep.cjs.
    const cov = (await this.db.execute(sql`
      SELECT slug, año, docs_clonados, hitos_con_url, docs_por_clonar, hitos_enlazables, citas_sin_fuente
      FROM convocatoria_docs_coverage
      WHERE is_active = true AND is_current = true AND incompleto = true
      ORDER BY docs_por_clonar DESC, hitos_enlazables DESC
    `)) as unknown as Array<{
      slug: string;
      año: number;
      docs_clonados: number;
      hitos_con_url: number;
      docs_por_clonar: number;
      hitos_enlazables: number;
      citas_sin_fuente: number;
    }>;
    for (const r of cov) {
      const partes: string[] = [];
      if (r.docs_por_clonar)
        partes.push(`${r.docs_por_clonar} doc(s) referenciados sin clonar`);
      if (r.hitos_enlazables)
        partes.push(`${r.hitos_enlazables} enlazable(s) por URL`);
      if (r.citas_sin_fuente)
        partes.push(`${r.citas_sin_fuente} cita(s) sin fuente`);
      add(
        'content',
        'warn',
        r.slug,
        'convocatoria_docs_incompletos',
        `${r.slug}: provenance incompleta (${partes.join(', ')})`,
        {
          año: r.año,
          docs_clonados: r.docs_clonados,
          hitos_con_url: r.hitos_con_url,
          docs_por_clonar: r.docs_por_clonar,
          enlazables: r.hitos_enlazables,
          citas_sin_fuente: r.citas_sin_fuente,
        },
      );
    }
    marcar('convocatoria_docs_incompletos', cov.length);
    const orf = (await this.db.execute(sql`
      SELECT count(*) FILTER (WHERE url IS NOT NULL)::int con_url,
             count(*) FILTER (WHERE cita_literal IS NOT NULL AND length(btrim(cita_literal)) > 0)::int con_cita
      FROM convocatoria_hitos WHERE convocatoria_id IS NULL
    `)) as unknown as Array<{ con_url: number; con_cita: number }>;
    if (orf[0] && (orf[0].con_url > 0 || orf[0].con_cita > 0)) {
      add(
        'content',
        'warn',
        null,
        'convocatoria_docs_incompletos',
        `${orf[0].con_url} hito(s) con URL y ${orf[0].con_cita} con cita SIN convocatoria (provenance no atribuible; asignar a su ciclo)`,
        { orphan: true, con_url: orf[0].con_url, con_cita: orf[0].con_cita },
      );
    }
    marcar('convocatoria_docs_incompletos', orf[0] ? orf[0].con_url + orf[0].con_cita : 0);

    // ── CONTENIDO: CIFRA DE PLAZAS AFIRMADA SIN NINGÚN DOCUMENTO QUE LA CONTENGA ──
    // Hermano del anterior, un escalón más grave: aquel dice «falta papeleo», este dice «la landing
    // afirma un número que no está escrito en ninguna parte». Una cifra solo puede ser un HECHO (con
    // documento) o una PREVISIÓN (declarada con plazas_prevision); una cifra huérfana presentada como
    // hecho es como auxiliar-administrativo-estado acabó enseñando un total de 2.170 inexistente.
    // Mirror de lib/convocatoria/cifraEnTexto.cjs — el porqué de la tabla de numerales y la válvula
    // `cifra_derivada` están allí. Gemelo de scripts/health-sweep.cjs: MANTENER EN SYNC.
    const huerfanas = (await this.db.execute(sql`
      SELECT o.slug, cv.plazas_libres, cv.boe_reference, cv."año",
             (SELECT count(*)::int FROM convocatoria_documentos d WHERE d.convocatoria_id = cv.id) docs,
             (SELECT string_agg(d.extracted_text, ' ') FROM convocatoria_documentos d
               WHERE d.convocatoria_id = cv.id) corpus,
             (SELECT (v.state = 'verified_correct' AND v.findings ? 'cifra_derivada')
                FROM convocatoria_verification v WHERE v.convocatoria_id = cv.id) derivada_declarada,
             (SELECT v.source_snippet FROM convocatoria_verification v WHERE v.convocatoria_id = cv.id) derivada_snippet
        FROM convocatorias cv JOIN oposiciones o ON o.id = cv.oposicion_id
       WHERE cv.is_current AND o.is_active
         AND cv.plazas_libres IS NOT NULL
         AND NOT cv.plazas_prevision
       ORDER BY cv.plazas_libres DESC NULLS LAST
    `)) as unknown as Array<{
      slug: string; plazas_libres: number; boe_reference: string | null; año: number;
      docs: number; corpus: string | null; derivada_declarada: boolean | null; derivada_snippet: string | null;
    }>;
    for (const h of huerfanas) {
      if (!esPlazaHuerfana(h)) continue;
      add(
        'content',
        'error',
        h.slug,
        'plazas_afirmadas_sin_documento',
        h.docs === 0
          ? `${h.slug}: afirma ${h.plazas_libres} plazas (ciclo ${h.año}) y NO hay NINGÚN documento en el corpus. O se clona su fuente, o se marca plazas_prevision con motivo`
          : `${h.slug}: afirma ${h.plazas_libres} plazas (ciclo ${h.año}) y ninguno de sus ${h.docs} documento(s) contiene esa cifra, ni en dígitos ni en letra: o el documento clonado no es el que la prueba, o la cifra está mal`,
        { plazas: h.plazas_libres, referencia: h.boe_reference, año: h.año, docs: h.docs },
      );
    }
    marcar('plazas_afirmadas_sin_documento', huerfanas.length);

    // ── CONTENIDO: PROVENANCE de EPÍGRAFES (verified_literal sin documento del hub enlazado) ──
    // Gemelo del anterior para el OTRO consumidor del hub convocatoria_documentos. Un epígrafe
    // verified_literal cuyo source_documento_id es NULL = provenance huérfana: se validó contra
    // una URL suelta, no contra el documento clonado (txt.php ≠ /pdfs → no casaba). Se enlaza
    // vía ensure_convocatoria_documento (verify-epigrafe-literality record lo hace ya). Cierra
    // el falso verde de provenance de T-107. Runbook: docs/maintenance/provenance-convocatorias.md.
    const epiOrf = (await this.db.execute(sql`
      SELECT replace(t.position_type, '_', '-') AS slug, count(*)::int AS huerfanos
      FROM topics t
      JOIN topic_epigrafe_verification ev ON ev.topic_id = t.id
      WHERE t.is_active AND ev.state = 'verified_literal' AND ev.source_documento_id IS NULL
      GROUP BY 1 ORDER BY 2 DESC
    `)) as unknown as Array<{ slug: string; huerfanos: number }>;
    for (const r of epiOrf) {
      add(
        'content',
        'warn',
        r.slug,
        'epigrafe_provenance_no_doc',
        `${r.slug}: ${r.huerfanos} epígrafe(s) verified_literal sin documento del hub enlazado (source_documento_id NULL) — re-verificar o enlazar vía ensure_convocatoria_documento`,
        { huerfanos: r.huerfanos },
      );
    }
    marcar('epigrafe_provenance_no_doc', epiOrf.length);

    // ── CONTENIDO: REVISIÓN de temario pendiente (Fase 2 de temario-versionado-por-convocatoria) ──
    // Oposición activa con convocatoria vigente cuyo temario NO está verificado del todo contra su
    // fuente oficial → toca revisar con verify:epigrafe/scope y aplicar los diffs al temario vivo.
    // Nace del gap sistémico (25/07): el temario no se actualiza al llegar convocatoria nueva; el
    // 88% de las oposiciones con convocatoria 2024+ nunca se contrastó con el boletín. Se emite UN
    // finding agregado (no inunda el badge con 111). Cola completa: scripts/temario/detect-temario-revision.
    // MANTENER EN SYNC con scripts/health-sweep.cjs.
    const revQ = (await this.db.execute(sql`
      WITH tv AS (
        SELECT t.position_type, count(*)::int temas,
               count(*) FILTER (WHERE ev.state = 'verified_literal')::int verificados
        FROM topics t LEFT JOIN topic_epigrafe_verification ev ON ev.topic_id = t.id
        WHERE t.is_active GROUP BY 1),
      users AS (SELECT target_oposicion pt, count(*)::int n FROM user_profiles WHERE target_oposicion IS NOT NULL GROUP BY 1)
      SELECT o.slug, COALESCE(u.n, 0)::int usuarios
      FROM tv
      JOIN oposiciones o ON o.is_active AND replace(o.slug, '_', '-') = replace(tv.position_type, '_', '-')
      JOIN convocatorias cv ON cv.oposicion_id = o.id AND cv.is_current
      LEFT JOIN users u ON u.pt = tv.position_type
      WHERE tv.verificados < tv.temas
      ORDER BY usuarios DESC
    `)) as unknown as Array<{ slug: string; usuarios: number }>;
    if (revQ.length > 0) {
      const usuarios = revQ.reduce((a, r) => a + r.usuarios, 0);
      add(
        'content',
        'warn',
        null,
        'temario_revision_pendiente',
        `${revQ.length} oposiciones con convocatoria vigente cuyo temario NO está verificado del todo contra su fuente oficial (${usuarios} usuarios) — revisar con verify:epigrafe/scope`,
        { oposiciones: revQ.length, usuarios, top: revQ.slice(0, 15) },
      );
    }
    marcar('temario_revision_pendiente', revQ.length);

    // ── CONVOCATORIAS: invariantes deterministas del timeline (vista convocatoria_hito_incidencias) ──
    // I1/I2/I9 = graves (error); I7/I8 = caducado (warn). I5 se excluye a propósito (línea base sin docs).
    {
      const inc = (await this.db.execute(sql`
        SELECT o.slug, i.invariante, i.detalle
          FROM convocatoria_hito_incidencias i
          JOIN convocatorias cv ON cv.id = i.convocatoria_id
          JOIN oposiciones o ON o.id = cv.oposicion_id
         WHERE o.is_active AND i.invariante <> 'I5_registro_sin_fuente'
      `)) as unknown as Array<{ slug: string; invariante: string; detalle: string }>;
      const porSlug: Record<string, Array<{ invariante: string; detalle: string }>> = {};
      for (const r of inc) (porSlug[r.slug] = porSlug[r.slug] || []).push(r);
      for (const [slug, rs] of Object.entries(porSlug)) {
        // I10 va en `graves` (severity=error), no en `stale`: no es un hito viejo sin
        // cerrar, es MISINFORMACIÓN visible — la landing anuncia "plazo cerrado" en un
        // proceso que aún no se ha convocado, así que el usuario cree que perdió el plazo
        // y se va (T-124, caso administrativo-pais-vasco). Reutiliza el kind existente
        // para no inflar el badge con uno nuevo.
        const graves = rs.filter(
          (r) =>
            r.invariante === 'I1_orden' ||
            r.invariante === 'I2_duplicado' ||
            r.invariante === 'I9_tipo_incoherente' ||
            r.invariante === 'I10_inscripcion_sin_convocatoria' ||
            // I11 (T-142): fila y hitos con fechas distintas del mismo plazo → la landing muestra
            // las dos. Misinformación visible, mismo cubo que I10.
            r.invariante === 'I11_fechas_inscripcion_vs_hitos',
        );
        if (graves.length)
          add(
            'content',
            'error',
            slug,
            'convocatoria_timeline_incoherente',
            `${slug}: ${graves.length} incoherencia(s) en el timeline — ${graves[0].detalle}`,
            { incidencias: graves.map((r) => ({ invariante: r.invariante, detalle: r.detalle })) },
          );
        const stale = rs.filter(
          (r) =>
            r.invariante === 'I7_prevision_caducada' ||
            r.invariante === 'I8_status_contradice_fecha',
        );
        if (stale.length)
          add(
            'content',
            'warn',
            slug,
            'convocatoria_timeline_caducado',
            `${slug}: ${stale.length} hito(s) caducados o con estado que contradice su fecha`,
            { incidencias: stale.map((r) => ({ invariante: r.invariante, detalle: r.detalle })) },
          );
      }
      marcar('convocatoria_timeline_incoherente', inc.length);
      marcar('convocatoria_timeline_caducado', inc.length);
    }

    // ── Hitos que anuncian un evento con la fecha YA PASADA ──
    // origen='registro' → la fecha era real y el evento ocurrió, nadie cerró el hito (error);
    // origen≠registro → estimación vencida sin revisar (warn, no se publica pero delata).
    const hitosVencidos = (await this.db.execute(sql`
      SELECT o.slug, ch.origen, COUNT(*)::int n
      FROM convocatoria_hitos ch JOIN oposiciones o ON o.id = ch.oposicion_id
      WHERE o.is_active AND ch.status = 'upcoming' AND ch.fecha < CURRENT_DATE
      GROUP BY o.slug, ch.origen
    `)) as unknown as Array<{ slug: string; origen: string | null; n: number }>;
    for (const r of hitosVencidos) {
      const estimado = r.origen !== 'registro';
      add(
        'content',
        estimado ? 'warn' : 'error',
        r.slug,
        'hito_vencido_abierto',
        `${r.slug}: ${r.n} hito(s) "próximos" con fecha ya pasada` +
          (estimado
            ? ' (fecha ESTIMADA sin publicar; no se muestra, pero revísala)'
            : ' (fecha REAL: el evento ocurrió y el hito sigue anunciándolo como futuro)'),
      );
    }
    marcar('hito_vencido_abierto', hitosVencidos.length);

    // ── seguimiento_url que vigilan un ciclo YA CERRADO (falso negativo silencioso) ──
    const urlRows = (await this.db.execute(sql`
      SELECT o.slug, o.seguimiento_url AS su, c."año" AS anio_vig,
             c.estado_proceso AS estado
      FROM oposiciones o
      JOIN convocatorias c ON c.oposicion_id = o.id AND c.is_current
      WHERE o.is_active AND o.seguimiento_url IS NOT NULL
    `)) as unknown as Array<{
      slug: string;
      su: string | null;
      anio_vig: number | null;
      estado: string | null;
    }>;
    for (const r of urlRows) {
      // procesoEnJuego = hay convocatoria PUBLICADA con ficha viva (procesoConFichaViva) → un
      // seguimiento genérico aquí es ceguera accionable (error). En oep_aprobada (esperando bases)
      // el índice es la vigilancia legítima → 'ok'. Mirror de lib/convocatoria/seguimientoUrlSalud.cjs.
      const d = diagnosticarSeguimientoUrl(
        r.su,
        r.anio_vig != null ? Number(r.anio_vig) : null,
        { procesoEnJuego: procesoConFichaViva(r.estado) },
      );
      if (d.severidad === 'ok') continue;
      add(
        'content',
        d.severidad,
        r.slug,
        'seguimiento_url_stale',
        `${r.slug}: seguimiento_url ${d.nivel === 'stale_boletin' ? 'DESFASADA' : 'sospechosa'} — ${d.motivo}`,
      );
    }
    marcar('seguimiento_url_stale', urlRows.length);

    // ── estado_proceso que se contradice con sus PROPIAS fechas ─────────────────────────
    // Misma detección que `npm run audit:estados`. Esa lógica llevaba desde el 18/06 en un CLI
    // cuyos hallazgos iban a un log/email y NO a `content_health_findings`: 1 error y 34 avisos
    // que no aparecían ni en el badge ni en /admin/contenido. Aquí se publican con el resto.
    // Determinista (solo fechas): ni IA ni boletines. Decidir el estado correcto exige fuente
    // oficial y es trabajo humano → docs/runbooks/verificar-convocatorias.md.
    {
      const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
      const filas = (await this.db.execute(sql`
        SELECT slug, is_active, estado_proceso,
               inscription_start::text        AS inscription_start,
               inscription_deadline::text     AS inscription_deadline,
               exam_date::text                AS exam_date,
               exam_date_approximate,
               seguimiento_url,
               seguimiento_last_checked::text AS seguimiento_last_checked,
               boe_reference,
               boe_publication_date::text     AS boe_publication_date
        FROM oposiciones_ssot`)) as unknown as Array<Record<string, unknown>>;
      for (const o of filas) {
        for (const inc of detectarIncoherenciasEstado(o, hoy)) {
          add(
            'content',
            inc.severidad,
            String(o.slug),
            'convocatoria_estado_incoherente',
            `${String(o.slug)}${o.is_active ? ' [PUBLICADA]' : ''}: ${inc.mensaje}`,
          );
        }
      }
      marcar('convocatoria_estado_incoherente', filas.length);
    }

    // ── seguimiento_url que responde 200 pero NO VIGILA NADA (seguimiento_fuente_ciega) ──
    // Hermano del anterior con causa distinta: la URL es la correcta pero el contenido no llega.
    // El cron hashea el HTML servido SIN ejecutar JS → una SPA (o un "página en desuso", o un WAF
    // que responde 200) devuelve un shell inmutable: hash congelado, estado 'ok', panel verde y
    // cero vigilancia. Origen T-114/T-125 (26/07).
    //
    // `checked_url = seguimiento_url` es OBLIGATORIO: sin ese filtro, una oposición recién
    // repuntada se juzga con la evidencia de su URL anterior (falso positivo garantizado). Sin
    // evidencia atribuible NO se juzga (fail-safe). Solo se emite la banda `error`; la banda
    // `warn` se adjudica bajo demanda con scripts/seguimiento/sim-fuentes-ciegas.cjs --todos.
    //
    // ENSANCHADO 27/07 (T-165): el clasificador mira también la CABECERA sin límite de longitud →
    // caen aquí las páginas RICAS que no vigilan nada (404 con 200, pantalla de error, muro de
    // login, ficha de catálogo). Simulado bank-wide antes de encender: +73 hallazgos, 0 falsos
    // positivos, y solo 1 en oposición ACTIVA (el resto, catalogadas).
    //
    // Mirror INLINE de lib/convocatoria/seguimientoVigilable.cjs — MANTENER EN SYNC (el backend
    // NestJS no puede importar del `lib/` del frontend). Umbrales y patrones idénticos: los
    // vigila __tests__/lib/convocatoria/seguimientoVigilable.test.js (paridad de constantes).
    const ciegaRows = (await this.db.execute(sql`
      SELECT o.slug, ch.http_status, ch.error_message, ch.content_preview
      FROM oposiciones o
      JOIN LATERAL (
        SELECT k.http_status, k.error_message, k.content_preview
        FROM convocatoria_seguimiento_checks k
        WHERE k.oposicion_id = o.id AND k.checked_url = o.seguimiento_url
        ORDER BY k.checked_at DESC LIMIT 1
      ) ch ON true
      WHERE o.is_active AND o.seguimiento_url IS NOT NULL
    `)) as unknown as Array<{
      slug: string;
      http_status: number | null;
      error_message: string | null;
      content_preview: string | null;
    }>;
    for (const r of ciegaRows) {
      const v = clasificarVigilanciaInline(
        r.http_status,
        r.error_message,
        r.content_preview,
      );
      if (v.severidad !== 'error') continue;
      add(
        'content',
        'error',
        r.slug,
        'seguimiento_fuente_ciega',
        `${r.slug}: la seguimiento_url responde pero NO se puede vigilar (${v.nivel}) — ${v.motivo}`,
      );
    }
    marcar('seguimiento_fuente_ciega', ciegaRows.length);

    // ── NOTAS INTERNAS PUBLICADAS EN LA LANDING (nota_interna_publicada, T-435) ──
    // Los campos de REFERENCIA se PINTAN en el hero y bajo el botón oficial, y se estaban usando
    // como bloc de notas de auditoría. Medido el 31/07: 7 landings activas sirviendo cosas como
    // «⚠️ SIN VERIFICAR: la fila afirma 688 plazas…», o sea, contándole al opositor que no nos
    // fiamos de nuestra propia cifra.
    //
    // Se lee de `oposiciones_ssot` y no de `oposiciones`: el mismo barrido sobre la tabla base da
    // CERO con el texto en pantalla, porque la nota vive en `convocatorias` y la vista resuelve
    // desde ahí. Núcleo puro compartido con el CLI — un solo criterio, sin copia que derive.
    // GOTCHA Drizzle+postgres-js: `execute()` devuelve YA el array (`RowList`), no un `{rows}`.
    // Poner `.rows` compila en el frontend y NO aquí — lo cazó el typecheck del backend en el
    // pre-push, que además avisa de que el job `typecheck` del CI tampoco lo habría visto.
    const notaRows = (await this.db.execute(sql`
      SELECT slug, is_active, boe_reference, diario_referencia, convocatoria_numero, oep_decreto
        FROM oposiciones_ssot`)) as unknown as Array<{
      slug: string;
      is_active: boolean;
      boe_reference: string | null;
      diario_referencia: string | null;
      convocatoria_numero: string | null;
      oep_decreto: string | null;
    }>;
    for (const h of clasificarNotasInternas(
      notaRows.map((r) => ({
        slug: r.slug,
        isActive: r.is_active,
        campos: {
          boe_reference: r.boe_reference,
          diario_referencia: r.diario_referencia,
          convocatoria_numero: r.convocatoria_numero,
          oep_decreto: r.oep_decreto,
        },
      })),
    ).todos) {
      add(
        'content',
        h.severity as 'error' | 'warn',
        h.slug,
        'nota_interna_publicada',
        `${h.slug}: el campo ${h.campo} publica una nota interna [${h.tipo}] — ${h.extracto.slice(0, 90)}`,
      );
    }
    marcar('nota_interna_publicada', notaRows.length);

    // ── Enlace "Ver en BOE" que NO corresponde a la referencia mostrada (convocatoria_link_mismatch) ──
    // Se lee de `oposiciones_ssot` (lo que VE el opositor): la landing compone la tarjeta
    // oficial con `diario_oficial` (etiqueta) + `programa_url` (enlace) + `boe_reference`.
    const linkRows = (await this.db.execute(sql`
      SELECT s.slug, s.boe_reference AS ref, s.programa_url AS url, s.diario_oficial AS etiqueta,
             s.estado_proceso AS estado,
             -- Documento de la OEP vigente ya clonado: el enlace que la landing enseña DE VERDAD
             -- mientras no hay convocatoria (F4/T-108). Espejo de la query del CLI.
             (SELECT d.url FROM convocatorias c
                JOIN convocatoria_oep co ON co.convocatoria_id = c.id
                JOIN oep e ON e.id = co.oep_id
                JOIN convocatoria_documentos d ON d.id = e.source_documento_id
              WHERE c.oposicion_id = o.id AND c.is_current = true AND d.url IS NOT NULL
              ORDER BY e."año_oep" DESC LIMIT 1) AS enlace_oep
      FROM oposiciones_ssot s
      JOIN oposiciones o ON o.slug = s.slug
      WHERE s.is_active
    `)) as unknown as Array<{
      slug: string;
      ref: string | null;
      url: string | null;
      etiqueta: string | null;
      estado: string | null;
      enlace_oep: string | null;
    }>;
    for (const r of linkRows) {
      const idRef = extraerIdBoeInline(r.ref);
      const idUrl = extraerIdBoeInline(r.url);
      if (idRef && idUrl && idRef !== idUrl) {
        add(
          'content',
          'error',
          r.slug,
          'convocatoria_link_mismatch',
          `${r.slug}: el enlace "Ver en BOE" no corresponde a la referencia mostrada — muestra ${idRef} pero el enlace va a ${idUrl}`,
        );
      }
      // ── La ETIQUETA del botón promete un boletín y el enlace lleva a otro ──
      // Punto ciego del check de arriba: ahí referencia y enlace SÍ casan (mismo BOE); lo que
      // miente es el texto. Incidente 25/07: "Ver convocatoria en BOJA" enlazando a boe.es.
      // Espejo de lib/convocatoria/linkCoherence.cjs (`etiqueta_boletin_mismatch`), que es la
      // FUENTE DE VERDAD y tiene los tests; aquí va nativo porque el backend NestJS no puede
      // importar el `lib/` del frontend. MANTENER EN SYNC.
      const etiqueta = normalizarEtiquetaBoletinInline(r.etiqueta);
      // Espejo de `enlaceOficialEfectivo` (lib/convocatoria/enlaceOficial.cjs): sin convocatoria
      // publicada y con documento de OEP clonado, el botón enlaza ESE documento y se rotula
      // "Ver OEP en {diario}" — juzgar `programa_url` a pelo marca lo que el opositor no ve.
      const esOepSinConvocatoriaInline = ['sin_oep', 'oep_aprobada'].includes(r.estado ?? 'sin_oep');
      const urlEfectiva = (esOepSinConvocatoriaInline && r.enlace_oep) ? r.enlace_oep : r.url;
      const boletinUrl = boletinDeUrlInline(urlEfectiva);
      if (etiqueta && boletinUrl && boletinUrl !== etiqueta) {
        add(
          'content',
          'error',
          r.slug,
          'convocatoria_etiqueta_boletin',
          `${r.slug}: el botón oficial promete un boletín y lleva a otro — la etiqueta dice "${etiqueta}" pero el enlace apunta al ${boletinUrl}`,
        );
      } else if (etiqueta && r.url && !boletinUrl) {
        // ── El botón promete un boletín y el enlace NO ES DE NINGUNO (T-134, 26/07) ──
        // Punto ciego de los dos checks de arriba: ambos exigen reconocer un boletín en la URL,
        // así que un portal institucional los dejaba mudos. Caso raíz: `policia-nacional`, con
        // plazo ABIERTO, prometía el BOE y llevaba a policia.es/portalaspirantes/**en**/… — ni
        // BOE, ni convocatoria, ni español. Calibrado para NO tocar la cola larga legítima (las
        // bases en PDF colgadas de la sede de la entidad no se marcan).
        const s = señalesDeUrlInline(urlEfectiva);
        const razones: string[] = [];
        if (s.portadaOSeccion) razones.push('no es un documento, es una portada/sección de portal');
        if (s.idiomaExtranjero) razones.push('la página está en otro idioma');
        if (razones.length) {
          add(
            'content',
            ESTADOS_FICHA_VIVA_INLINE.has(r.estado ?? '') ? 'error' : 'warn',
            r.slug,
            'convocatoria_enlace_no_boletin',
            `${r.slug}: el botón oficial no lleva al boletín que promete — el botón promete "${etiqueta}" pero el enlace ${razones.join('; además ')}`,
          );
        } else if (s.pareceTemario && !esOepSinConvocatoriaInline) {
          // Solo si el botón PROMETE la convocatoria: con "Ver OEP en X" no hay promesa que romper.
          add(
            'content',
            'warn',
            r.slug,
            'convocatoria_enlace_no_boletin',
            `${r.slug}: el botón oficial no lleva al boletín que promete — el botón promete la convocatoria en "${etiqueta}" y el enlace es un TEMARIO`,
          );
        }
      }
    }
    marcar('convocatoria_link_mismatch', linkRows.length);
    marcar('convocatoria_etiqueta_boletin', linkRows.length);
    marcar('convocatoria_enlace_no_boletin', linkRows.length);

    // ── Documentos oficiales clonados que NADIE ha revisado (documentos_sin_revisar) ────────
    // Espejo del gemelo CLI. El cron clona los documentos de las oposiciones que preparamos y la
    // decisión la toma una sesión leyendo la FUENTE; antes eso lo pre-masticaba un LLM barato
    // (6.886 extracciones, 0 triadas, ~17 USD). La bandeja se ve aquí para que no se acumule.
    const docsRows = (await this.db.execute(sql`
      SELECT o.slug, count(*)::int n, min(d.created_at)::date AS mas_viejo
        FROM convocatoria_documentos d
        JOIN convocatorias cv ON cv.id = d.convocatoria_id
        JOIN oposiciones o ON o.id = cv.oposicion_id
       WHERE o.is_active AND cv.is_current AND cv.archived_at IS NULL
         AND d.extracted_text IS NOT NULL
         AND d.created_at > now() - interval '30 days'
         AND cv.estado_proceso IN ('inscripcion_abierta','convocatoria_publicada','convocada','inscripcion_cerrada','lista_admitidos','pendiente_examen')
         AND NOT EXISTS (
           SELECT 1 FROM observable_events e
            WHERE e.event_type = 'documento_revisado' AND e.metadata->>'documentoId' = d.id::text)
       GROUP BY o.slug
    `)) as unknown as Array<{ slug: string; n: number; mas_viejo: string }>;
    for (const r of docsRows) {
      add(
        'content',
        'warn',
        r.slug,
        'documentos_sin_revisar',
        `${r.slug}: ${r.n} documento(s) oficial(es) clonado(s) SIN revisar (el más antiguo, del ${String(r.mas_viejo).slice(0, 10)}) — revísalos con npm run docs:bandeja`,
      );
    }
    marcar('documentos_sin_revisar', docsRows.length);
    // ── Feedback PENDIENTE sin conversación (feedback_sin_conversacion) ────────────────────
    // Espejo del gemelo CLI. El endpoint de respuesta exige un hilo: sin fila en
    // `feedback_conversations` devuelve 409 y el feedback es INCONTESTABLE — el usuario espera
    // una respuesta que no llegará nunca. Pasó de verdad: las solicitudes que entraban por el
    // chat de IA no creaban conversación y las 6 de abril-julio se cerraron sin contestar.
    //
    // Estaba SOLO en el CLI, así que el @Cron nocturno —el que escribe el snapshot que pinta el
    // panel— nunca lo emitía: un detector de severidad `error` invisible en la práctica. Lo
    // destapó el guardarraíl de paridad al ejecutarlo el 28/07/2026 (llevaba rojo en `main`).
    // Se excluyen las bajas de cuenta: van por su propio manual y no se responden por el hilo.
    const sinConvRows = (await this.db.execute(sql`
      SELECT f.id, f.type, left(f.message, 90) AS msg, f.created_at
        FROM user_feedback f
       WHERE f.status = 'pending'
         AND f.message NOT LIKE '[Solicitud de eliminación de cuenta%'
         AND NOT EXISTS (SELECT 1 FROM feedback_conversations c2 WHERE c2.feedback_id = f.id)
       ORDER BY f.created_at
       LIMIT 50
    `)) as unknown as Array<{ id: string; type: string; msg: string; created_at: string }>;
    if (sinConvRows.length)
      add(
        'app',
        'error',
        null,
        'feedback_sin_conversacion',
        `${sinConvRows.length} feedback(s) PENDIENTES sin conversación: el endpoint de respuesta los rechaza (409), así que son incontestables y el usuario nunca recibirá contestación`,
        {
          count: sinConvRows.length,
          sample: sinConvRows.slice(0, 10).map((r) => ({
            id: r.id,
            type: r.type,
            msg: r.msg,
            creado: r.created_at,
          })),
        },
      );
    marcar('feedback_sin_conversacion', sinConvRows.length);

    // ── CHAT IA caído: respuestas de ERROR servidas a usuarios (chat_ia_errores) ──────────
    // Espejo del gemelo CLI (scripts/health-sweep.cjs). El chat sirvió 210 respuestas de error
    // con `had_error = false` en las 210, así que NADA lo veía: lo destaparon 27 usuarios
    // pulsando el pulgar abajo, semanas después.
    //
    // Se mira el TEXTO servido y no `had_error` a propósito: la columna se empezó a rellenar
    // ahora, y los errores viejos seguirán en `false` un tiempo. El texto estuvo desde el
    // principio.
    //
    // Nació solo en el CLI (28/07), así que el @Cron —que es quien ESCRIBE el snapshot del
    // panel— no lo emitía: un detector `error` invisible en la práctica, el mismo patrón que
    // ya había pasado con `feedback_sin_conversacion`. Lo cazó el guardarraíl de paridad.
    const chatErr = (await this.db.execute(sql`
      SELECT count(*)::int AS n, max(created_at) AS ult,
             count(DISTINCT user_id)::int AS usuarios
        FROM ai_chat_logs
       WHERE created_at > now() - interval '24 hours'
         AND (full_response ILIKE '%ha ocurrido un error%'
           OR full_response ILIKE '%hubo un error al procesar%'
           OR full_response ILIKE '%no está disponible ahora mismo%')
    `)) as unknown as Array<{ n: number; ult: string; usuarios: number }>;
    if (chatErr[0]?.n > 0)
      add(
        'app',
        'error',
        null,
        'chat_ia_errores',
        `${chatErr[0].n} respuesta(s) de ERROR servidas por el chat IA en 24h a ${chatErr[0].usuarios} usuario(s) — el asistente está fallando (mira el errorStatus en ai_chat_traces: sin saldo del proveedor, modelo inexistente…)`,
        { n: chatErr[0].n, usuarios: chatErr[0].usuarios, ultimo: chatErr[0].ult },
      );
    marcar('chat_ia_errores', chatErr[0]?.n ?? 0);

    // ── Landings PUBLICADAS a medio hacer (landing_incompleta) ──
    // Caso raíz 25/07: Aux. Admin. UAL llevaba semanas activa con el hero sin tarjetas, 0 FAQs,
    // sin descripción y sin SEO. `audit:oposicion` lo cantaba, pero es on-demand. Espejo de
    // lib/convocatoria/landingCompleteness.cjs (fuente de verdad + tests). MANTENER EN SYNC.
    const landRows = (await this.db.execute(sql`
      SELECT slug, landing_estadisticas, landing_faqs, landing_description,
             seo_title, seo_description, titulo_requerido, examen_config
      FROM oposiciones_ssot WHERE is_active
    `)) as unknown as Array<{
      slug: string;
      landing_estadisticas: unknown;
      landing_faqs: unknown;
      landing_description: string | null;
      seo_title: string | null;
      seo_description: string | null;
      titulo_requerido: string | null;
      examen_config: unknown;
    }>;
    const MIN_FAQS = 3;
    const vacioTxt = (v: string | null) => v == null || String(v).trim() === '';
    const arrOk = (v: unknown, min: number) => Array.isArray(v) && v.length >= min;
    const objOk = (v: unknown) =>
      v != null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length > 0;
    for (const r of landRows) {
      const faltan: string[] = [];
      let hayError = false;
      if (!arrOk(r.landing_estadisticas, 1)) {
        faltan.push('tarjetas del hero (landing_estadisticas)');
        hayError = true;
      }
      if (!arrOk(r.landing_faqs, MIN_FAQS)) {
        faltan.push(`FAQs (mínimo ${MIN_FAQS})`);
        hayError = true;
      }
      if (vacioTxt(r.landing_description)) faltan.push('landing_description');
      if (vacioTxt(r.seo_title)) faltan.push('seo_title');
      if (vacioTxt(r.seo_description)) faltan.push('seo_description');
      if (vacioTxt(r.titulo_requerido)) faltan.push('titulo_requerido');
      if (!objOk(r.examen_config)) faltan.push('examen_config');
      if (faltan.length === 0) continue;
      add(
        'content',
        hayError ? 'error' : 'warn',
        r.slug,
        'landing_incompleta',
        `${r.slug}: landing publicada ${hayError ? 'INCOMPLETA' : 'mejorable'} — falta ${faltan.join(', ')}`,
      );
    }
    marcar('landing_incompleta', landRows.length);

    // ── Convocatorias con OEP en texto pero SIN enlazar a la entidad oep (convocatoria_oep_sin_enlace) ──
    const oepLinkRows = (await this.db.execute(sql`
      SELECT o.slug, count(*)::int AS n
      FROM convocatorias cv JOIN oposiciones o ON o.id = cv.oposicion_id
      WHERE o.is_active AND cv.oep_decreto IS NOT NULL AND btrim(cv.oep_decreto) <> ''
        AND NOT EXISTS (SELECT 1 FROM convocatoria_oep co WHERE co.convocatoria_id = cv.id)
      GROUP BY o.slug
    `)) as unknown as Array<{ slug: string; n: number }>;
    for (const r of oepLinkRows) {
      add(
        'content',
        'warn',
        r.slug,
        'convocatoria_oep_sin_enlace',
        `${r.slug}: ${r.n} convocatoria(s) con OEP en texto pero SIN enlazar a la entidad oep → el histórico muestra el año de convocatoria, no el de OEP. Correr: node scripts/oep/poblar-historico.cjs ${r.slug}`,
      );
    }
    marcar('convocatoria_oep_sin_enlace', oepLinkRows.length);

    // ── Textos libres que anuncian un examen pasado como vigente (punto ciego del rollover) ──
    const hoyIso = now.toISOString().slice(0, 10);
    const textoRows = (await this.db.execute(sql`
      SELECT o.slug,
             COALESCE(v.landing_faqs, o.landing_faqs) AS faqs,
             COALESCE(v.landing_description, o.landing_description) AS descr
      FROM oposiciones o
      LEFT JOIN LATERAL (
        SELECT c2.landing_faqs, c2.landing_description
        FROM convocatorias c2 WHERE c2.oposicion_id = o.id AND c2.is_current LIMIT 1
      ) v ON TRUE
      WHERE o.is_active
    `)) as unknown as Array<{ slug: string; faqs: unknown; descr: unknown }>;
    for (const r of textoRows) {
      const h = detectarExamenPasado({ landingDescription: r.descr, landingFaqs: r.faqs }, hoyIso);
      if (!h.length) continue;
      const fechas = [...new Set(h.map((x) => x.iso))].join(', ');
      add(
        'content',
        'warn',
        r.slug,
        'texto_examen_pasado',
        `${r.slug}: los textos de la landing anuncian un examen ya pasado como vigente (${fechas}) — el opositor ve una fecha vieja como la próxima`,
      );
    }
    marcar('texto_examen_pasado', textoRows.length);

    // ── CONTENIDO: SOBRE-INCLUSIÓN de topic_scope (epígrafe enumera, scope = ley entera) ──
    // Solo banda HIGH (título con hueco / arts citados = precisión alta); MEDIUM (prosa) no pinga.
    // Las dos guardas de abajo llegaron al gemelo CLI el 26/07 y NO se copiaron aquí, que es
    // el writer REAL: hasta el 31/07 el @Cron nocturno escribía este kind con el criterio
    // viejo. Medido ese día sobre datos vivos: el CLI daba 0 y el @Cron 2, y los 2 eran casos
    // YA adjudicados `ok` — o sea, hallazgos que el panel no podía bajar hiciera lo que
    // hiciera nadie. El test de paridad no lo vio porque compara los `kind` que emite cada
    // fichero, no la LÓGICA con que los emite (punto ciego anotado en [T-088]).
    const overIncl = (await this.db.execute(sql`
      SELECT t.position_type pt, t.topic_number tn, l.short_name ley, t.epigrafe,
             ts.article_numbers,
             (SELECT count(*) FROM articles a WHERE a.law_id = ts.law_id AND a.article_number ~ '^[0-9]+$') law_total
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id JOIN laws l ON l.id = ts.law_id
      WHERE t.is_active = true
        -- (1) El badge tiene que poder BAJAR: fuera los (tema, ley) ya adjudicados con
        -- veredicto 'ok', que es el estado final tanto de un falso positivo como de un
        -- recorte YA APLICADO. Los adjudicados 'over_inclusion' SÍ siguen contando aquí:
        -- son trabajo por hacer, y además tienen su propio kind (..._confirmed).
        AND NOT EXISTS (
          SELECT 1 FROM scope_over_inclusion_adjudications adj
           WHERE adj.topic_id = ts.topic_id AND adj.law_id = ts.law_id AND adj.verdict = 'ok'
        )
    `)) as unknown as Array<{
      pt: string;
      tn: number;
      ley: string | null;
      epigrafe: string | null;
      article_numbers: string[] | null;
      law_total: number;
    }>;
    const oiHigh: Array<{
      pt: string;
      tema: number;
      ley: string | null;
      cobertura: number;
      motivo: string | null;
    }> = [];
    for (const r of overIncl) {
      // (2) NULL en `article_numbers` = TODA la ley (convención del proyecto). Contarlo como
      // 0 artículos dejaba **1.924 de 5.964 scopes (32%)** invisibles a este detector aquí
      // — justo los que más pueden pasarse de ancho.
      const scoped =
        r.article_numbers === null
          ? Number(r.law_total)
          : r.article_numbers.filter((x) => /^[0-9]+$/.test(x)).length;
      const v = classifyScope(Number(r.law_total), scoped, r.epigrafe);
      if (v.band === 'HIGH')
        oiHigh.push({
          pt: r.pt,
          tema: r.tn,
          ley: r.ley,
          cobertura: Math.round(v.coverage * 100),
          motivo: v.reason,
        });
    }
    if (oiHigh.length) {
      oiHigh.sort((a, b) => b.cobertura - a.cobertura);
      const nOpos = new Set(oiHigh.map((x) => x.pt)).size;
      add(
        'content',
        'warn',
        null,
        'scope_over_inclusion_suspect',
        `${oiHigh.length} tema(s) con SCOPE MÁS ANCHO que el epígrafe (mete casi la ley entera) en ${nOpos} oposición(es) — sirve preguntas fuera de programa; adjudicar con verify:scope y recortar el scope`,
        { count: oiHigh.length, oposiciones: nOpos, sample: oiHigh.slice(0, 20) },
      );
    }
    marcar('scope_over_inclusion_suspect', overIncl.length);

    // ── CONTENIDO: recortes de sobre-inclusión ya CONFIRMADOS y sin aplicar ──
    // Mirror de scripts/health-sweep.cjs — MANTENER EN SYNC.
    // El kind de arriba dice «esto huele a sobre-inclusión, hay que adjudicarlo»; éste dice
    // «ya se adjudicó contra el BOE y el tema SIGUE sirviendo la materia de más». Medido el
    // 31/07 (T-088): sospechosos 0, confirmados sin aplicar 16 en 12 oposiciones — el
    // pipeline funcionó y su propio éxito hizo desaparecer su salida del panel.
    const oiConf = (await this.db.execute(sql`
      SELECT t.position_type pt, t.topic_number tn, l.short_name ley, a.band,
             left(coalesce(a.arts_correctos, ''), 80) AS arts_correctos,
             a.adjudicado_at::date AS adjudicado
        FROM scope_over_inclusion_adjudications a
        JOIN topics t ON t.id = a.topic_id
        JOIN laws l ON l.id = a.law_id
       WHERE a.verdict = 'over_inclusion' AND a.verificado
         AND t.is_active = true
       ORDER BY t.position_type, t.topic_number
    `)) as unknown as Array<{ pt: string; tn: number; ley: string | null }>;
    if (oiConf.length) {
      const nOpos = new Set(oiConf.map((x) => x.pt)).size;
      add(
        'content',
        'warn',
        null,
        'scope_over_inclusion_confirmed',
        `${oiConf.length} recorte(s) de scope ya ADJUDICADOS contra la fuente oficial y sin aplicar, en ${nOpos} oposición(es) — esos temas siguen sirviendo materia fuera de programa; aplicar con verify:scope plan/apply`,
        { count: oiConf.length, oposiciones: nOpos, sample: oiConf.slice(0, 20) },
      );
    }
    marcar('scope_over_inclusion_confirmed', oiConf.length);

    // ── CONTENIDO: ARTÍCULOS FANTASMA del scope (integridad referencial) ──
    // Nº en topic_scope.article_numbers sin fila ACTIVA en articles (mismo law_id) → 0
    // preguntas/teoría EN SILENCIO. `inexistente` (no hay fila) o `desactivado`
    // (is_active=false, aunque tenga preguntas). Regex dígito-inicial (excluye basura CE
    // "T3"/"TP") + variantes latinas + matching NORMALIZADO (sin acentos/espacios/')' ) para
    // no inventar falsos por formato. Separa por boe_url (real accionable vs ofimática).
    const phantom = (await this.db.execute(sql`
      WITH refs AS (
        SELECT DISTINCT ts.law_id, l.short_name, l.name, (l.boe_url IS NOT NULL) AS has_boe, trim(an) AS art
        FROM topic_scope ts
        JOIN topics t ON t.id = ts.topic_id
        JOIN laws l ON l.id = ts.law_id
        CROSS JOIN LATERAL unnest(ts.article_numbers) AS an
        WHERE ts.article_numbers IS NOT NULL AND t.is_active = true
      )
      SELECT coalesce(r.short_name, r.name) AS ley, r.has_boe, r.art,
             CASE WHEN NOT EXISTS (SELECT 1 FROM articles a WHERE a.law_id = r.law_id AND lower(regexp_replace(translate(a.article_number, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'), '[[:space:])]', '', 'g')) = lower(regexp_replace(translate(r.art, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'), '[[:space:])]', '', 'g')))
                  THEN 'inexistente' ELSE 'desactivado' END AS causa
      FROM refs r
      WHERE r.art ~* '^[0-9]+( ?(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?( ?[a-z)]*)?$'
        AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.law_id = r.law_id AND lower(regexp_replace(translate(a.article_number, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'), '[[:space:])]', '', 'g')) = lower(regexp_replace(translate(r.art, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'), '[[:space:])]', '', 'g')) AND a.is_active)
    `)) as unknown as Array<{ ley: string; has_boe: boolean; art: string; causa: string }>;
    if (phantom.length) {
      const real = phantom.filter((p) => p.has_boe);
      const virt = phantom.filter((p) => !p.has_boe);
      const leyesReal = [...new Set(real.map((p) => p.ley))];
      const inex = real.filter((p) => p.causa === 'inexistente').length;
      const desact = real.filter((p) => p.causa === 'desactivado').length;
      if (real.length)
        add(
          'content',
          'warn',
          null,
          'scope_phantom_article',
          `${real.length} artículo(s) escopado(s) que NO sirven (0 preguntas/teoría en silencio) en ${leyesReal.length} ley(es): ${inex} inexistente(s) + ${desact} desactivado(s) — importar del BOE / reactivar / o recortar el scope si la ley no lo tiene`,
          {
            count: real.length,
            laws: leyesReal.length,
            inexistentes: inex,
            desactivados: desact,
            virtual_ofimatica: virt.length,
            sample: real.slice(0, 25).map((p) => ({ ley: p.ley, art: p.art, causa: p.causa })),
          },
        );
    }
    marcar('scope_phantom_article', phantom.length);

    // ── CONTENIDO: MISMA LEY REAL duplicada ENTRE TEMAS (repartir por materia) ──
    // Mirror INLINE de scripts/health-sweep.cjs (scope_cross_tema_dup) — MANTENER EN SYNC.
    // Ley REAL escopada ENTERA (article_numbers NULL/vacío) o con solape grande (≥20 arts)
    // en ≥2 temas activos de la MISMA oposición → mismas preguntas repetidas en varios
    // tests sin reparto por materia. Punto ciego de over-inclusion (1 tema vs epígrafe) y de
    // huecos (los temas rebosan). Umbral conservador: ley entera/NULL compartida o ≥20 arts
    // (solape 1-10 = cross-cutting legítimo, no pinga).
    const ctRows = (await this.db.execute(sql`
      SELECT t.position_type pt, l.short_name ley, t.topic_number tn, ts.article_numbers an
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id JOIN laws l ON l.id = ts.law_id
      WHERE t.is_active = true
        AND (l.short_name ~* '^(Ley|Real|Decreto|Estatut|Llei|Convenio|Reglament|Constituci|Tratado)' OR l.short_name ~ '^(LO|RD|RDL|CE|TR|TUE|TFUE|RGPD)')
    `)) as unknown as Array<{
      pt: string;
      ley: string;
      tn: number;
      an: string[] | null;
    }>;
    const ctGroups = new Map<string, typeof ctRows>();
    for (const r of ctRows) {
      const k = r.pt + ' ' + r.ley;
      let g = ctGroups.get(k);
      if (!g) ctGroups.set(k, (g = []));
      g.push(r);
    }
    const ctDups: Array<{ pt: string; ley: string; dup: string }> = [];
    for (const [k, rows] of ctGroups) {
      if (rows.length < 2) continue;
      const [pt, ley] = k.split(' ');
      const arrs = rows.map((r) => {
        const a = r.an || [];
        const nums = a
          .map((x) => parseInt(String(x).replace(/[^0-9]/g, ''), 10))
          .filter((n) => !isNaN(n));
        return { tn: r.tn, set: new Set(nums), nulish: a.length === 0 };
      });
      let maxOv = 0;
      let pair: string | null = null;
      if (arrs.filter((a) => a.nulish).length > 1) {
        maxOv = 9999;
        pair =
          arrs
            .filter((a) => a.nulish)
            .map((a) => 'T' + a.tn)
            .join('=T') + ' (ley entera/NULL)';
      } else {
        for (let i = 0; i < arrs.length; i++)
          for (let j = i + 1; j < arrs.length; j++) {
            let cc = 0;
            for (const n of arrs[i].set) if (arrs[j].set.has(n)) cc++;
            if (cc > maxOv) {
              maxOv = cc;
              pair = 'T' + arrs[i].tn + '∩T' + arrs[j].tn + '=' + cc + ' arts';
            }
          }
      }
      if (maxOv >= 20 && pair) ctDups.push({ pt, ley, dup: pair });
    }
    if (ctDups.length) {
      const nOpos = new Set(ctDups.map((x) => x.pt)).size;
      add(
        'content',
        'warn',
        null,
        'scope_cross_tema_dup',
        `${ctDups.length} ley(es) REAL duplicada(s) entre temas (misma ley entera/solape grande en ≥2 temas → preguntas repetidas en varios tests) en ${nOpos} oposición(es) — repartir por materia con verify:scope (npm run scope:health -- --pending)`,
        { count: ctDups.length, oposiciones: nOpos, sample: ctDups.slice(0, 20) },
      );
    }
    marcar('scope_cross_tema_dup', ctRows.length);

    // ── CONTENIDO: scope SIN VERIFICAR contra el epígrafe (cierra el punto ciego) ──
    // Un topic_scope nunca auditado (o `stale`) contra el epígrafe oficial es un HUECO:
    // puede servir preguntas fuera de programa sin que salte nada (caso Auxiliar
    // Extremadura, 25/07). Antes solo se cazaba on-demand (audit:epigrafe / verify:scope);
    // ahora el panel lo marca. Agregado por OPOSICIÓN (no por tema) para no inundar.
    // Mirror INLINE de scripts/health-sweep.cjs (scope_sin_verificar) — MANTENER EN SYNC.
    const svRows = (await this.db.execute(sql`
      SELECT o.slug,
        count(t.id)::int AS temas,
        count(t.id) FILTER (WHERE v.state IN ('verified_correct','verified_issues'))::int AS verificados,
        count(t.id) FILTER (WHERE v.state IS NULL OR v.state NOT IN ('verified_correct','verified_issues'))::int AS sin_auditar
      FROM oposiciones o
      JOIN topics t ON t.position_type = replace(o.slug, '-', '_') AND t.is_active = true
      LEFT JOIN topic_scope_verification v ON v.topic_id = t.id
      WHERE o.is_active = true
      GROUP BY o.slug
      HAVING count(t.id) FILTER (WHERE v.state IS NULL OR v.state NOT IN ('verified_correct','verified_issues')) > 0
      ORDER BY sin_auditar DESC
    `)) as unknown as Array<{ slug: string; temas: number; verificados: number; sin_auditar: number }>;
    for (const r of svRows) {
      add(
        'content',
        'warn',
        r.slug,
        'scope_sin_verificar',
        `${r.slug}: ${r.sin_auditar}/${r.temas} tema(s) con scope SIN auditar (o stale) contra el epígrafe oficial — el temario podría servir preguntas fuera de programa sin avisar. Verifica con verify:scope.`,
        { temas: r.temas, verificados: r.verificados, sin_auditar: r.sin_auditar },
      );
    }
    marcar('scope_sin_verificar', svRows.length);

    // Mirror INLINE de scripts/health-sweep.cjs (shuffle_encendido_sin_efecto) — MANTENER EN SYNC.
    //
    // La bandera del barajado activa y ni una sola respuesta reciente con `option_order`. Un piloto
    // que no produce señal es indistinguible de uno que va bien: el 28/07/2026 estuvo así 8 horas,
    // con `option_order` a NULL en el 100 % de las filas mientras el servidor SÍ barajaba. Eso
    // significa que la permutación no vuelve al guardar, y entonces el servidor corrige la posición
    // MOSTRADA contra la clave ORIGINAL → fallos falsos en silencio.
    if (String(process.env.FEATURE_SHUFFLE_OPTIONS || '').toLowerCase() === 'true') {
      const shufRows = (await this.db.execute(sql`
        SELECT count(*)::int AS respuestas, count(option_order)::int AS con_orden
          FROM test_questions
         WHERE created_at > now() - interval '24 hours'
      `)) as unknown as Array<{ respuestas: number; con_orden: number }>;
      const shuf = shufRows[0];
      if (shuf && shuf.respuestas > 100 && shuf.con_orden === 0) {
        add(
          'app',
          'error',
          null,
          'shuffle_encendido_sin_efecto',
          `El barajado está ACTIVO y ninguna de las ${shuf.respuestas} respuestas de las últimas 24h guarda el orden servido: o no baraja de verdad (piloto inerte) o la permutación no vuelve al guardar (y entonces se están registrando fallos falsos)`,
          { respuestas24h: shuf.respuestas, conOrden: shuf.con_orden, scope: process.env.FEATURE_SHUFFLE_OPTIONS_SCOPE || null },
        );
      }
      marcar('shuffle_encendido_sin_efecto', shuf ? shuf.respuestas : 0);
    }

    // ── Hitos que se presentan como fecha OFICIAL sin ninguna fuente ───────────────
    // Mirror INLINE de scripts/health-sweep.cjs (hito_registro_sin_fuente) — MANTENER EN SYNC.
    // Bandas calibradas con simulación bank-wide antes de encender: error = fecha de EXAMEN
    // futura en oposición activa (medido en vivo el 28/07: 3 hallazgos / 4 hitos, sobre 25
    // candidatos y 21 exentos); warn = el resto (medido: 0, porque las
    // candidatas coincidían con el deadline verificado y el núcleo las exime).
    const hitosSinFuenteRows = (await this.db.execute(sql`
      SELECT h.id, h.titulo, h.origen, h.url, h.cita_literal, h.source_documento_id, h.fecha,
             o.slug, c2.inscription_deadline
      FROM convocatoria_hitos h
      JOIN oposiciones o ON o.id = h.oposicion_id
      LEFT JOIN convocatorias c2 ON c2.oposicion_id = o.id AND c2.is_current
      WHERE o.is_active AND h.origen = 'registro' AND h.fecha > CURRENT_DATE
    `)) as unknown as Array<{
      id: string; titulo: string; origen: string; url: string | null;
      cita_literal: string | null; source_documento_id: string | null;
      fecha: string; slug: string; inscription_deadline: string | null;
    }>;
    const hitosSinFuentePorClave = new Map<string, typeof hitosSinFuenteRows>();
    for (const h of hitosSinFuenteRows) {
      if (!hitoSinFuente(h, h.inscription_deadline)) continue;
      const clave = `${h.slug}|${hitoEsDeExamen(h) ? 'examen' : 'otro'}`;
      if (!hitosSinFuentePorClave.has(clave)) hitosSinFuentePorClave.set(clave, []);
      hitosSinFuentePorClave.get(clave)!.push(h);
    }
    for (const [clave, hs] of hitosSinFuentePorClave) {
      const [slug, tipo] = clave.split('|');
      const esExamen = tipo === 'examen';
      add(
        'content',
        esExamen ? 'error' : 'warn',
        slug,
        'hito_registro_sin_fuente',
        `${slug}: ${hs.length} hito(s) se muestran como fecha OFICIAL sin ninguna fuente` +
          (esExamen
            ? ' — y son fechas de EXAMEN: el opositor organiza meses de estudio con ellas'
            : ' (fecha futura sin url, cita ni documento)'),
        { count: hs.length, hitos: hs.slice(0, 10).map((h) => ({ id: h.id, titulo: h.titulo, fecha: h.fecha })) },
      );
    }
    marcar('hito_registro_sin_fuente', hitosSinFuenteRows.length);

    // ── Mapa de visibilidad frío: index-only scans que NO lo son (T-275) ──
    // Cuando el mapa se enfría, Postgres sigue diciendo «Index Only Scan» en el plan pero baja al
    // heap fila por fila: el resultado es correcto y tarda cien veces más. Por eso NINGÚN indicador
    // lo veía — no es un error, es una respuesta correcta que llega tarde (punto ciego de T-254).
    // Caso real 29/07: `test_questions` al 67,5% → 72.695 heap fetches y 17.809 ms en la consulta
    // de theme-stats; tras calentar el mapa, 0 y 145 ms.
    //
    // ⚠️ ESPEJO de `lib/db/visibilityMap.cjs` (el núcleo puro y testeado que usa el script CLI).
    // El backend NO puede importarlo: su imagen Docker solo copia `backend/src`. Si tocas un
    // umbral aquí, tócalo allí — `content-sweep-parity.test.ts` vigila los KINDS, y los umbrales
    // están fijados por los tests del núcleo con los números reales del incidente.
    try {
      const VM_MIN_PAGES = 5000, VM_WARN_PCT = 90, VM_ERROR_PCT = 70;
      // Se traen también las estadísticas de escritura porque el REMEDIO las necesita: sin ellas el
      // hallazgo solo podía decir «revisa el autovacuum», que es justo lo que hubo que diagnosticar
      // a mano en `questions` y lo que mandaba a buscar un problema inexistente en el outbox (T-275).
      const vmRows = (await this.db.execute(sql`
        SELECT c.relname AS relname, c.relpages::int AS relpages, c.relallvisible::int AS relallvisible,
               (COALESCE(c.reloptions::text, '') ILIKE '%insert_scale%') AS tiene_ajuste,
               s.n_live_tup::bigint AS vivas, s.n_dead_tup::bigint AS muertas,
               s.n_ins_since_vacuum::bigint AS ins_pend,
               COALESCE(NULLIF(substring(COALESCE(c.reloptions::text,'') from 'autovacuum_vacuum_insert_threshold=([0-9]+)'),'')::int, 1000) AS ins_threshold,
               COALESCE(NULLIF(substring(COALESCE(c.reloptions::text,'') from 'autovacuum_vacuum_insert_scale_factor=([0-9.]+)'),'')::float, 0.2) AS ins_scale,
               COALESCE(NULLIF(substring(COALESCE(c.reloptions::text,'') from 'autovacuum_vacuum_scale_factor=([0-9.]+)'),'')::float, 0.2) AS scale_muertas
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
          JOIN pg_stat_user_tables s ON s.relid = c.oid
         WHERE c.relkind = 'r' AND c.relpages > ${VM_MIN_PAGES}
      `)) as unknown as Array<{
        relname: string; relpages: number; relallvisible: number; tiene_ajuste: boolean;
        vivas: string | number; muertas: string | number; ins_pend: string | number;
        ins_threshold: string | number; ins_scale: string | number; scale_muertas: string | number;
      }>;
      // Mirror de `remedioVisibilidad` (lib/db/visibilityMap.cjs) — MANTENER EN SYNC. Las cuatro
      // ramas están fijadas por los tests del núcleo con los números reales: el outbox al 84,2% con
      // 1.333 inserts pendientes de 1.342 es RÉGIMEN (el autovacuum va a entrar), `questions` al
      // 78,5% con 0 pendientes y muertas bajo umbral es ATASCO. Y el criterio no puede ser ni el
      // ratio de borrado ni un umbral de reloj: los dos se probaron y fallan (ver el núcleo).
      const VM_CICLO_INSERTS_FRACCION = 0.5;
      const remedioVm = (r: {
        relname: string; tiene_ajuste: boolean; vivas: string | number; muertas: string | number;
        ins_pend: string | number; ins_threshold: string | number; ins_scale: string | number;
        scale_muertas: string | number;
      }): string => {
        if (!r.tiene_ajuste)
          return `ALTER TABLE public.${r.relname} SET (autovacuum_vacuum_insert_scale_factor = 0.01, autovacuum_vacuum_insert_threshold = 1000)`;
        const vivas = Number(r.vivas) || 0;
        const muertas = Number(r.muertas) || 0;
        const ins = Number(r.ins_pend) || 0;
        const scale = Number(r.scale_muertas) || 0.2;
        const umbral = Math.round(100 + scale * vivas);
        const umbralIns = Math.round((Number(r.ins_threshold) || 1000) + (Number(r.ins_scale) || 0.2) * vivas);
        if (umbralIns > 0 && ins >= VM_CICLO_INSERTS_FRACCION * umbralIns && muertas < umbral)
          return `régimen de rotación alta, NO abandono: el autovacuum está A MITAD DE CICLO (${ins} inserts pendientes de los ${umbralIns} que lo disparan) y las muertas (${muertas}) están por debajo de su umbral (${umbral}) — la maquinaria funciona y la tabla se vuelve a enfriar porque se llena y se vacía sin parar (típico de una cola). Solo importa si alguna consulta suya depende de index-only scans; si no, no hay nada que arreglar`;
        if (vivas > 0 && muertas < umbral && ins === 0)
          return `NO se arreglará sola: ${muertas} filas muertas contra un umbral de ${umbral} (scale ${scale}) y 0 inserts pendientes — por debajo de los dos disparadores. Hace falta VACUUM (ANALYZE) manual + bajar autovacuum_vacuum_scale_factor de esta tabla`;
        return `tiene el ajuste de inserts pero sigue fría: mirar si el autovacuum llega (workers saturados, cost_delay) — ${muertas} muertas / umbral ~${umbral}, ${ins} inserts pendientes`;
      };
      const frias = (Array.isArray(vmRows) ? vmRows : [])
        .map((r) => {
          const pct = r.relpages > 0 ? Math.round((100 * r.relallvisible) / r.relpages * 10) / 10 : 100;
          return { ...r, pct, paginasFrias: Math.max(0, r.relpages - r.relallvisible) };
        })
        .filter((r) => r.pct < VM_WARN_PCT)
        // Por PÁGINAS FRÍAS, no por porcentaje: una tabla de 8 GB al 80% arrastra mucho más I/O
        // que una de 40 MB al 46%, y el porcentaje las hace parecer iguales.
        .sort((a, b) => b.paginasFrias - a.paginasFrias);
      // PREVENTIVO (espejo de tablasSinAjuste): grande y sin protección, aunque hoy esté caliente.
      for (const t of (Array.isArray(vmRows) ? vmRows : []).filter((r) => !r.tiene_ajuste).slice(0, 5)) {
        add('app', 'warn', null, 'visibility_map_sin_ajuste',
          `\`${t.relname}\` (${t.relpages.toLocaleString('es-ES')} páginas) NO tiene el ajuste de autovacuum por inserts: se enfriará tarde o temprano y nadie la despertará`,
          { tabla: t.relname, relpages: t.relpages, remedio: remedioVm(t) });
      }
      for (const f of frias.slice(0, 5)) {
        add(
          'app',
          f.pct < VM_ERROR_PCT ? 'error' : 'warn',
          null,
          'visibility_map_frio',
          `\`${f.relname}\` con solo el ${f.pct}% de páginas marcadas visibles (${f.paginasFrias.toLocaleString('es-ES')} frías): sus index-only scans bajan al heap y pueden tardar 100× más`,
          {
            tabla: f.relname, pctVisible: f.pct, paginasFrias: f.paginasFrias, relpages: f.relpages,
            remedio: remedioVm(f),
          },
        );
      }
      marcar('visibility_map_sin_ajuste', vmRows.length);
      marcar('visibility_map_frio', vmRows.length);
    } catch (e) {
      this.logger.warn(`mapa de visibilidad no evaluado: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    }

    // ── Epígrafe con la cabecera/pie del PDF del boletín incrustada (T-171) ──
    // ⚠️ ESPEJO de `lib/health/epigrafeRuidoBoletin.cjs` (el núcleo puro y testeado que usa el CLI).
    // El backend NO puede importarlo: su imagen Docker solo copia `backend/src`. Si tocas un patrón
    // aquí, tócalo allí — `content-sweep-parity.test.ts` vigila que los KINDS no diverjan.
    //
    // `fir?ma` con la `r` opcional es a propósito: «Fima automática» es el OCR REAL del caso de
    // Córdoba. Y «Depósito legal» NO acusa solo — es materia legítima en biblioteconomía y fue la
    // causa de 2 de los 4 «hallazgos» del barrido del 27/07.
    try {
      const MARCADORES = [
        /copia electrónica de un documento/i, /código seguro de verificación/i,
        /powered by tcpdf/i, /\bfir?ma autom[áa]tica\b/i,
        /bolet[íi]n oficial de la provincia/i, /\bn[ºo]\s?\d{1,5}\s+p\.\s?\d{1,6}\b/i,
      ];
      const epRows = (await this.db.execute(sql`
        SELECT position_type AS slug, topic_number AS tema, epigrafe
          FROM topics WHERE epigrafe IS NOT NULL
      `)) as unknown as Array<{ slug: string; tema: number; epigrafe: string }>;
      const sucios = (Array.isArray(epRows) ? epRows : [])
        .map((e) => {
          const hits = MARCADORES.map((re) => e.epigrafe?.match(re)?.[0]?.trim()).filter(Boolean) as string[];
          const dep = /dep[óo]sito legal/i.exec(e.epigrafe ?? '')?.[0];
          return { ...e, marcadores: hits.length ? (dep ? [...hits, dep] : hits) : [] };
        })
        .filter((e) => e.marcadores.length > 0);
      for (const e of sucios.slice(0, 10)) {
        add('content', 'warn', e.slug, 'epigrafe_ruido_boletin',
          `${e.slug} T${e.tema}: el epígrafe trae incrustada la cabecera/pie del PDF del boletín (${e.marcadores.slice(0, 2).join(' · ')})`,
          { slug: e.slug, tema: e.tema, marcadores: e.marcadores });
      }
      marcar('epigrafe_ruido_boletin', epRows.length);
    } catch (e) {
      this.logger.warn(`ruido de boletín en epígrafes no evaluado: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    }

    // ── Explicación estructurada que se RENDERIZA rota (29/07) ──
    // ⚠️ ESPEJO de `lib/health/explicacionEstructuraRota.cjs` (núcleo puro y testeado que usa el
    // CLI). El backend NO puede importarlo: su imagen Docker solo copia `backend/src`. Si tocas la
    // regla aquí, tócala allí — `content-sweep-parity.test.ts` vigila que los KINDS no diverjan.
    //
    // Desde que producción compone el texto desde `explanation_data`, un campo mal formado ahí sale
    // a pantalla tal cual. El defecto dominante es un `**` sin pareja en una razón, herencia de la
    // transcripción del histórico, que partía «**A) Insertar** — …» y se quedaba con «Insertar** —».
    //
    // La guarda de `bloque` NO es opcional: ese campo es el blockquote íntegro y MANDA sobre
    // ref/texto en el render. Sin ella, la rama de la cita dispara 1.412 falsos positivos de golpe.
    try {
      const impar = (x: unknown) => ((String(x ?? '').match(/\*\*/g) || []).length % 2) === 1;
      const exRows = (await this.db.execute(sql`
        SELECT q.id, q.explanation_data,
               (SELECT count(*) FROM test_questions tq WHERE tq.question_id = q.id)::int AS servidas
          FROM questions q
         WHERE q.is_active = true AND q.explanation_data IS NOT NULL
      `)) as unknown as Array<{ id: string; explanation_data: any; servidas: number }>;
      const rotas = (Array.isArray(exRows) ? exRows : [])
        .map((q) => {
          const d = q.explanation_data ?? {};
          const averias: string[] = [];
          const campos = [d.intro, d.outro, ...Object.values(d.options ?? {})];
          for (const b of d.blocks ?? []) campos.push(b?.intro, b?.texto);
          if (d.cita && typeof d.cita === 'object') campos.push(d.cita.bloque, d.cita.texto);
          if (campos.some(impar)) averias.push('negrita_impar');
          const c = d.cita;
          if (c && typeof c === 'object' && !String(c.bloque ?? '').trim()) {
            const ref = String(c.ref ?? '').trim();
            if (ref && !String(c.texto ?? '').trim()) {
              averias.push('cita_sin_texto');
              if (ref.length > 60) averias.push('cita_ref_es_el_texto');
            }
          }
          return { id: q.id, averias, servidas: Number(q.servidas ?? 0) };
        })
        .filter((q) => q.averias.length > 0)
        .sort((a, b) => b.servidas - a.servidas);
      if (rotas.length) {
        const exposiciones = rotas.reduce((a, b) => a + b.servidas, 0);
        add('content', 'warn', null, 'explicacion_estructura_rota',
          `${rotas.length} explicación(es) estructurada(s) se renderizan rotas (${exposiciones} exposiciones acumuladas)`,
          { total: rotas.length, exposiciones, muestra: rotas.slice(0, 10) });
      }
      marcar('explicacion_estructura_rota', exRows.length);
    } catch (e) {
      this.logger.warn(`estructura de explicaciones no evaluada: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    }

    // ── Explicación CORTADA a mitad de frase (T-250) ──
    // ⚠️ ESPEJO de `lib/health/explicacionTruncada.cjs` (núcleo puro y testeado que usa el CLI). El
    // backend NO puede importarlo: su imagen Docker solo copia `backend/src`. Si tocas la regla
    // aquí, tócala allí — `content-sweep-parity.test.ts` vigila que los KINDS no diverjan.
    //
    // Hermana de la anterior y distinta: allí el texto está entero y se PINTA mal; aquí termina en
    // seco y falta lo que venía detrás («…los miembros del Cuerpo Nacional de»).
    //
    // EL CRITERIO ES GRAMATICAL, NO ORTOGRÁFICO, y eso no es un detalle de estilo: «no acaba en
    // signo de cierre» da 8.938 sobre 136.310 activas y casi todas son correctas (cierran con la
    // referencia de la fuente, con una URL, o están mal puntuadas pero completas). Mirando en
    // cambio si la ÚLTIMA PALABRA pide continuación: 112 hallazgos, 20 de 20 correctos en muestra
    // aleatoria. Las tres exclusiones son las que sostienen esa precisión: URLs (`isAllowed=y` no
    // es la conjunción), locuciones de cierre («entre otros») y letra suelta en mayúscula (la «O»
    // de una tabla de coordenadas es Oeste).
    try {
      const FUNCIONALES = new Set(
        ('a ante bajo cabe con contra de desde durante en entre hacia hasta mediante para por segun según sin so sobre tras ' +
          'y e o u ni que pero sino aunque porque si como cuando donde mientras pues ' +
          'el la los las un una unos unas del al lo su sus mi mis tu tus este esta estos estas ese esa esos esas ' +
          'aquel aquella aquellos aquellas cuyo cuya cuyos cuyas ' +
          'quien quienes cual cuales cuanto cuanta cuantos cuantas muy mas más menos tan tanto ' +
          'todo toda todos todas otro otra otros otras cada cualquier cualesquiera').split(' '),
      );
      const CIERRE = /[.!?…»"”')\]:]\s*$/;
      const LOCUCION_DE_CIERRE = /\b(entre otr[oa]s|etc)\s*$/i;
      const truncada = (texto: string): string | null => {
        const limpia = String(texto ?? '')
          .replace(/(\*\*|__|\*|`)+\s*$/, '')
          .replace(/ /g, ' ')
          .replace(/\s+$/, '');
        if (!limpia) return null;
        const ultimoToken = limpia.split(/\s/).pop() ?? '';
        if (/(https?:\/\/|www\.)/.test(ultimoToken) || /[/?=&]/.test(ultimoToken)) return null;
        if (LOCUCION_DE_CIERRE.test(limpia)) return null;
        if (/,\s*$/.test(limpia)) return 'coma_final';
        if (CIERRE.test(limpia)) return null;
        const ultima = (limpia.match(/([\wáéíóúñüÁÉÍÓÚÑÜ]+)\s*$/) ?? [])[1];
        if (!ultima) return null;
        if (ultima.length === 1 && ultima !== ultima.toLowerCase()) return null;
        return FUNCIONALES.has(ultima.toLowerCase()) ? 'palabra_funcional' : null;
      };
      const trRows = (await this.db.execute(sql`
        SELECT q.id, right(q.explanation, 220) AS cola,
               (SELECT count(*) FROM test_questions tq WHERE tq.question_id = q.id)::int AS servidas
          FROM questions q
         WHERE q.is_active = true AND q.explanation IS NOT NULL AND length(trim(q.explanation)) > 0
      `)) as unknown as Array<{ id: string; cola: string; servidas: number }>;
      const cortadas = (Array.isArray(trRows) ? trRows : [])
        .map((q) => ({ id: q.id, motivo: truncada(q.cola), cola: String(q.cola ?? '').slice(-70), servidas: Number(q.servidas ?? 0) }))
        .filter((q) => q.motivo !== null)
        .sort((a, b) => b.servidas - a.servidas);
      if (cortadas.length) {
        const exposiciones = cortadas.reduce((a, b) => a + b.servidas, 0);
        add('content', 'warn', null, 'explicacion_truncada',
          `${cortadas.length} explicación(es) se cortan a mitad de frase (${exposiciones} exposiciones acumuladas)`,
          { total: cortadas.length, exposiciones, muestra: cortadas.slice(0, 10) });
      }
      marcar('explicacion_truncada', trRows.length);
    } catch (e) {
      this.logger.warn(`explicaciones truncadas no evaluadas: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    }

    // ── Plazas publicadas con una SUMA que puede ser falsa (29/07/2026, caso Concha) ──
    // Gemelo de scripts/health-sweep.cjs (MANTENER EN SYNC). Cuando no consta si la
    // reserva de discapacidad va dentro del turno libre o aparte, la vista SSOT supone
    // que va aparte y SUMA: si iba dentro, publicamos plazas que no existen. El bug de
    // código que sumaba en TODAS las superficies ya está arreglado y con guardarraíl;
    // esto vigila el hueco de DATOS. Se resuelve verificando el boletín, nunca suponiendo.
    try {
      const filasReserva = (await this.db.execute(sql`
        SELECT o.slug, c2.plazas_libres, c2.plazas_discapacidad,
               c2.plazas_discapacidad_incluidas AS incluidas
          FROM oposiciones o
          JOIN convocatorias c2 ON c2.oposicion_id = o.id AND c2.is_current
         WHERE o.is_active AND COALESCE(c2.plazas_discapacidad, 0) > 0
      `)) as unknown as Array<{ slug: string; plazas_libres: number | null; plazas_discapacidad: number | null; incluidas: boolean | null }>;
      for (const h of detectarReservaSinDeclarar(Array.isArray(filasReserva) ? filasReserva : []).slice(0, 12)) {
        add('content', h.severity, h.slug, 'plazas_reserva_sin_declarar', h.mensaje, {
          plazas_en_duda: h.plazas_en_duda,
        });
      }
      marcar('plazas_reserva_sin_declarar', filasReserva.length);
    } catch (e) {
      this.logger.warn(`reserva de discapacidad sin declarar no evaluada: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
    }

  }


  private async sendEmails(
    F: Finding[],
    stamp: string,
    isMonday: boolean,
  ): Promise<number> {
    const appErr = F.filter(
      (x) => x.category === 'app' && x.severity === 'error',
    );
    const contErr = F.filter(
      (x) => x.category === 'content' && x.severity === 'error',
    );
    const contWarn = F.filter(
      (x) => x.category === 'content' && x.severity === 'warn',
    );
    const line = (l: string, col: string) =>
      `<div style="font-family:monospace;font-size:13px;color:${col}">${esc(l)}</div>`;

    const APP_OBS_MIN = Number(process.env.APP_OBS_MIN || 10);
    const appFire = appErr.filter(
      (f) =>
        ['http_down', 'empty_topic'].includes(f.kind) ||
        (f.detail && Number(f.detail.n) >= APP_OBS_MIN),
    );

    let sent = 0;
    if (appFire.length) {
      const html = `<div style="font-family:sans-serif;max-width:640px"><h2 style="color:#b91c1c">🔴 Salud de la APP — ${esc(stamp)}</h2>
        <p>Fallos donde un usuario topa con un error (actúa):</p>${appFire.map((f) => line(f.message, '#b91c1c')).join('')}
        ${appErr.length > appFire.length ? `<p style="color:#6b7280;font-size:12px">(+${appErr.length - appFire.length} incidencia(s) de bajo volumen — blips — solo en el panel, no alertan.)</p>` : ''}
        <p style="color:#6b7280;font-size:12px;margin-top:20px">Panel: <a href="https://www.vence.es/admin/salud-sistema">/admin/salud-sistema</a> · Contenido (calidad) va en el resumen semanal.</p></div>`;
      if (
        await this.sendEmail(`🔴 Vence APP: ${appFire.length} fallo(s)`, html)
      )
        sent++;
    }
    if (isMonday && (contErr.length || contWarn.length)) {
      const html = `<div style="font-family:sans-serif;max-width:640px"><h2 style="color:#a16207">🟡 Salud del CONTENIDO (semanal) — ${esc(stamp)}</h2>
        <p>Datos a revisar (la app funciona, no urgente):</p>
        ${contErr.length ? '<h3>Incoherencias (❌)</h3>' + contErr.map((f) => line((f.slug ? f.slug + ' — ' : '') + f.message, '#b45309')).join('') : ''}
        ${
          contWarn.length
            ? `<h3>Menores (🟡) — ${contWarn.length}</h3>` +
              contWarn
                .slice(0, 20)
                .map((f) =>
                  line((f.slug ? f.slug + ' — ' : '') + f.message, '#a16207'),
                )
                .join('') +
              (contWarn.length > 20
                ? line(`… y ${contWarn.length - 20} más`, '#a16207')
                : '')
            : ''
        }
        <p style="color:#6b7280;font-size:12px;margin-top:20px">Pestaña Contenido: <a href="https://www.vence.es/admin/salud-sistema">/admin/salud-sistema</a></p></div>`;
      if (
        await this.sendEmail(
          `🟡 Vence contenido semanal: ${contErr.length} ❌ / ${contWarn.length} 🟡`,
          html,
        )
      )
        sent++;
    }
    if (!appFire.length && !(isMonday && (contErr.length || contWarn.length)))
      this.logger.log(
        `✅ ${stamp} — sin email (app sin fallos que alerten${isMonday ? ', contenido limpio' : ', contenido va el lunes'}).`,
      );
    return sent;
  }

  private async sendEmail(subject: string, html: string): Promise<boolean> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY no configurada — email de salud degradado (solo panel/log)',
      );
      return false;
    }
    const from = `Vence Salud <${this.config.get<string>('EMAIL_FROM_ADDRESS') || 'info@vence.es'}>`;
    const to = process.env.ALERT_EMAIL || 'manueltrader@gmail.com';
    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
      });
      if (error) {
        this.logger.error(`fallo email salud: ${JSON.stringify(error)}`);
        return false;
      }
      this.logger.log(`email salud enviado: ${subject} (${data?.id || 'ok'})`);
      return true;
    } catch (e) {
      this.logger.error(
        `fallo email salud: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }
}
