// backend/src/competitors/adapters/types.ts
//
// Contrato de un adapter de competidor. Uno por competidor (1 fichero + 1 línea
// de registro + 1 spec). Todo lo específico del sitio (esquema de URLs, markup de
// precios) vive aquí, aislado; el motor de sync y el almacenamiento son comunes.
//
// Diseño: docs/roadmap/analizador-competidores.md

export type UrlType = 'oposicion' | 'categoria' | 'page' | 'post' | 'other';

export type PriceKind =
  | 'matricula'
  | 'cuota'
  | 'intensivo'
  | 'tasa'
  | 'material'
  | 'otro';

export type PriceAudience = 'nuevo' | 'antiguo' | 'general';

export type PricePeriod = 'mensual' | 'trimestral' | 'unico' | 'curso';

export type Modalidad = 'online' | 'presencial' | 'mixta';

export interface ParsedPrice {
  kind: PriceKind;
  audience: PriceAudience | null;
  /** Importe en céntimos. Null si no parseable (raw se conserva igualmente). */
  amountCents: number | null;
  period: PricePeriod | null;
  /** Literal tal cual se vio (trazabilidad + debug del parser). */
  raw: string;
}

export interface ParsedCourse {
  rawName: string;
  modalidad: Modalidad | null;
  region: string | null;
  prices: ParsedPrice[];
}

export interface CompetitorAdapter {
  /** Identificador estable — DEBE coincidir con `competitors.slug` en BD. */
  readonly key: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly tipo: 'academia_presencial' | 'plataforma_online' | 'hibrida';
  readonly region: string;

  /**
   * OPCIONAL: pistas de stack que NO se pueden auto-detectar de la home
   * (p.ej. `rendering:'js'`, `has_public_api:true`, `lms:'moodle'`). Se mezclan
   * ENCIMA de lo auto-detectado. tecnoszubia no lo necesita (WordPress SSR).
   */
  readonly techHints?: Record<string, unknown>;

  /** Clasifica una URL del sitemap por su esquema (PURA). */
  classifyUrl(url: string): UrlType;

  /**
   * OPCIONAL (PURA): extrae URLs de una página de LISTADO/categoría. Red de
   * seguridad para landings que NO están en el sitemap (excluidas, huérfanas,
   * noindex). Se usa en fuentes `source_type='listing_html'`. Si el sitemap del
   * competidor es completo (p.ej. tecnoszubia), no hace falta implementarlo.
   */
  discoverUrls?(html: string): string[];

  /**
   * Parsea la página de un curso (URL clasificada como 'oposicion') a
   * nombre + modalidad + precios (PURA). Null si la página no es parseable.
   * Debe degradar con elegancia: un precio que falta ⇒ se omite, nunca lanza.
   */
  parseCourse(url: string, html: string): ParsedCourse | null;
}
