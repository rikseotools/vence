// backend/src/competitors/oposicion-identity.ts
//
// IDENTIDAD CANÓNICA de una oposición para el match competidor↔oposición.
//
// Una oposición NO es única por su nombre (el mismo cuerpo "Técnico Auxiliar de
// Informática" existe en Estado, en un Ayuntamiento y en una Universidad y son
// oposiciones distintas). Lo que la hace única es (ÁMBITO, REGIÓN):
//   - ámbito: estado | autonomica | local | universidad
//   - región: la administración concreta dentro del ámbito (CCAA para autonómica,
//             municipio para local, universidad para universidad; null para estado
//             porque el Estado es único).
//
// El match exige que ÁMBITO y REGIÓN coincidan (guarda dura) ANTES de comparar el
// cuerpo/materia por nombre. Así un curso de "Ayuntamiento de Zaragoza" nunca puede
// emparejar una oposición de ámbito Estado, por mucho que compartan el texto.
//
// Módulo PURO y sin dependencias de BD → 100% testeable. Diseño: memoria
// project_analizador_competidores + docs/roadmap/analizador-competidores.md

import { normalize } from '../oep-signals/oep-match';

export type Ambito = 'estado' | 'autonomica' | 'local' | 'universidad' | 'desconocido';

export interface OposicionIdentity {
  ambito: Ambito;
  /** Slug canónico de la región/administración concreta. Null para estado o si no se pudo determinar. */
  region: string | null;
}

/**
 * Mapa de CCAA: cada entrada tiene el slug canónico y sus alias/tokens (incluye
 * la administración autonómica típica). El primer patrón que casa gana. Ordenar de
 * más específico a más genérico dentro de lo posible.
 */
const CCAA: { slug: string; patterns: RegExp[] }[] = [
  { slug: 'comunidad-valenciana', patterns: [/generalitat valenciana/, /\bgva\b/, /comunitat valenciana/, /comunidad valenciana/, /\bvalenciana\b/, /\bgva\b/] },
  { slug: 'cataluna', patterns: [/generalitat de catalunya/, /generalitat catalunya/, /\bcatalunya\b/, /catalu[nñ]a/, /institut catala/] },
  { slug: 'andalucia', patterns: [/junta de andalucia/, /andalucia/, /\bsas\b/, /servicio andaluz de salud/] },
  { slug: 'madrid', patterns: [/comunidad de madrid/, /\bsermas\b/, /servicio madrileno de salud/, /\bmadrid\b/] },
  { slug: 'galicia', patterns: [/\bxunta\b/, /galicia/, /\bsergas\b/, /servizo galego/] },
  { slug: 'pais-vasco', patterns: [/\beuskadi\b/, /pais vasco/, /osakidetza/, /gobierno vasco/] },
  { slug: 'castilla-la-mancha', patterns: [/castilla la mancha/, /castilla-la mancha/, /\bsescam\b/, /\bclm\b/, /jccm/] },
  { slug: 'castilla-y-leon', patterns: [/castilla y leon/, /\bsacyl\b/, /\bjcyl\b/, /gerencia regional de salud de castilla/] },
  { slug: 'murcia', patterns: [/region de murcia/, /\bcarm\b/, /servicio murciano de salud/, /\bsms\b/] },
  { slug: 'aragon', patterns: [/\baragon\b/, /\bsalud\b aragon/, /servicio aragones/, /diputacion general de aragon/] },
  { slug: 'canarias', patterns: [/canarias/, /servicio canario de salud/, /\bscs\b/] },
  { slug: 'extremadura', patterns: [/extremadura/, /\bses\b/, /servicio extremeno/, /junta de extremadura/] },
  { slug: 'asturias', patterns: [/asturias/, /principado de asturias/, /\bsespa\b/] },
  { slug: 'baleares', patterns: [/illes balears/, /islas baleares/, /\bibsalut\b/, /govern balear/] },
  { slug: 'cantabria', patterns: [/cantabria/, /servicio cantabro/, /gobierno de cantabria/] },
  { slug: 'navarra', patterns: [/navarra/, /osasunbidea/, /gobierno de navarra/, /servicio navarro/] },
  { slug: 'la-rioja', patterns: [/\brioja\b/, /servicio riojano/, /gobierno de la rioja/] },
];

// Universidades frecuentes (slug canónico + tokens). Fallback: cualquier "universidad X".
const UNIVERSIDADES: { slug: string; patterns: RegExp[] }[] = [
  { slug: 'upm', patterns: [/universidad politecnica de madrid/, /\bupm\b/] },
  { slug: 'upv', patterns: [/universitat politecnica de valencia/, /universidad politecnica de valencia/, /\bupv\b/] },
  { slug: 'uned', patterns: [/\buned\b/] },
  { slug: 'ucm', patterns: [/universidad complutense/, /\bucm\b/] },
];

const UNIVERSIDAD_MARK = /\buniversi(dad|tat|ty)\b/;
// Local: ayuntamiento/diputación/cabildo/concello + "policía local" (¡no confundir
// con policía nacional!).
const LOCAL_MARK = /\b(ayuntamiento|ajuntament|diputacion|diputacio|concello|cabildo|consell insular|mancomunidad|entidad local|policia local|guardia urbana|bomberos)\b/;
// Estado: cuerpos estatales inequívocos. "administracion del estado", justicia,
// cuerpos de seguridad estatales, penitenciarias, correos, seguridad social estatal.
const ESTADO_MARK = /\b(estado|administracion general del estado|\bage\b|auxilio judicial|tramitacion procesal|gestion procesal|administracion de justicia|guardia civil|policia nacional|cuerpo nacional de policia|instituciones penitenciarias|ayudante(s)? de? instituciones|correos|ingesa|agencia tributaria|seguridad social)\b/;

/** Extrae el municipio de un texto local ("Ayuntamiento de Zamora" → "zamora"). */
function localRegion(t: string): string | null {
  const m = t.match(
    /\b(?:ayuntamiento|ajuntament|diputacion|diputacio|concello|cabildo|policia local|guardia urbana|bomberos)\s+(?:de\s+|de la\s+|del\s+|d[eio]\s+)?([a-z][a-z-]+(?:\s+[a-z][a-z-]+)?)/,
  );
  if (m) return m[1].trim().replace(/\s+/g, '-');
  return null;
}

function firstMatch(t: string, table: { slug: string; patterns: RegExp[] }[]): string | null {
  for (const { slug, patterns } of table) {
    if (patterns.some((p) => p.test(t))) return slug;
  }
  return null;
}

/**
 * Deriva la identidad (ámbito, región) de un texto libre. Para una oposición se le
 * pasa `administracion + " " + nombre`; para un curso de competidor, `url + " " +
 * rawName` (la taxonomía de URL suele traer la administración: p.ej. ADAMS
 * `/oposiciones/generalitat-valenciana/…`). Orden de decisión: universidad → local
 * → autonómica (por CCAA concreta) → estado. El orden importa: "policía LOCAL" es
 * local aunque contenga "policía"; una CCAA concreta gana al genérico "estado".
 */
export function deriveIdentity(text: string): OposicionIdentity {
  const t = normalize(text).replace(/[^a-z0-9]+/g, ' ');

  // 1) Universidad (marca inequívoca).
  if (UNIVERSIDAD_MARK.test(t)) {
    return { ambito: 'universidad', region: firstMatch(t, UNIVERSIDADES) ?? universidadRegion(t) };
  }
  // 2) Local (ayuntamiento/diputación/policía local…).
  if (LOCAL_MARK.test(t)) {
    // Puede además nombrar la CCAA, pero para local la región es el municipio.
    return { ambito: 'local', region: localRegion(t) };
  }
  // 3) Autonómica: si aparece una CCAA concreta (o su organismo/servicio de salud).
  const ccaa = firstMatch(t, CCAA);
  if (ccaa) {
    // Salvo que sea un cuerpo estatal que casualmente menciona la CCAA como sede.
    // Si además hay marca estatal fuerte y NO hay marca autonómica, prevalece estado.
    if (ESTADO_MARK.test(t) && !/\b(generalitat|xunta|junta de|principado|gobierno de|comunidad|comunitat|govern|autonomic|servicio (madrileno|andaluz|canario|aragones|extremeno|murciano|riojano|cantabro|navarro|vasco|catala|balear|galego))\b/.test(t)) {
      return { ambito: 'estado', region: null };
    }
    return { ambito: 'autonomica', region: ccaa };
  }
  // 4) Autonómica genérica (dice "autonómica"/"comunidad autónoma" sin CCAA concreta).
  if (/\b(autonomic[ao]|comunidad autonoma|comunitat autonoma)\b/.test(t)) {
    return { ambito: 'autonomica', region: null };
  }
  // 5) Estado.
  if (ESTADO_MARK.test(t)) return { ambito: 'estado', region: null };
  // 6) Local genérico ("administración local" sin municipio).
  if (/\blocal\b/.test(t)) return { ambito: 'local', region: null };

  return { ambito: 'desconocido', region: null };
}

function universidadRegion(t: string): string | null {
  const m = t.match(/\buniversi(?:dad|tat)\s+(?:politecnica\s+)?(?:de\s+|d[eio]\s+)?([a-z][a-z-]+)/);
  return m ? m[1] : null;
}

/**
 * ¿Son compatibles dos identidades para poder emparejar? Regla:
 *  - Si ambos ámbitos son conocidos y DISTINTOS → NO (guarda dura: estado≠local…).
 *  - Si algún ámbito es 'desconocido' → no bloquea (se decide por nombre, menor
 *    confianza); lo trata el matcher.
 *  - Dentro del mismo ámbito con REGIÓN: si ambas regiones son conocidas y
 *    distintas → NO. Si alguna es null → no bloquea por región.
 * Devuelve además si el emparejamiento está "reforzado" por identidad (ambos
 * ámbito+región conocidos y coincidentes) para graduar la confianza.
 */
export function identityCompatible(
  a: OposicionIdentity,
  b: OposicionIdentity,
): { compatible: boolean; reinforced: boolean } {
  if (a.ambito !== 'desconocido' && b.ambito !== 'desconocido' && a.ambito !== b.ambito) {
    return { compatible: false, reinforced: false };
  }
  const sameAmbito = a.ambito === b.ambito && a.ambito !== 'desconocido';
  if (sameAmbito && a.region && b.region && !regionCompatible(a.region, b.region)) {
    return { compatible: false, reinforced: false };
  }
  const reinforced = sameAmbito && !!a.region && !!b.region && regionCompatible(a.region, b.region);
  return { compatible: true, reinforced };
}

/**
 * Dos regiones son compatibles si la más corta es prefijo (por tokens) de la otra.
 * Robusto ante el ruido de la extracción libre ("cordoba" ≈ "cordoba-auxiliar") y
 * ante municipios compuestos ("las-palmas" ≈ "las-palmas-gran-canaria"), sin unir
 * "las-palmas" con "las-rozas".
 */
function regionCompatible(a: string, b: string): boolean {
  const ta = a.split('-');
  const tb = b.split('-');
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return short.every((tok, i) => long[i] === tok);
}
