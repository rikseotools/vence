// backend/src/competitors/adapters/generic-academy.ts
//
// Adapter GENÉRICO config-driven para academias con estructura estándar
// (WordPress/WooCommerce/etc. server-rendered). En vez de un fichero por
// competidor pequeño, un config por competidor: classifyUrl = regex de hoja,
// parseCourse = nombre del <title>/<h1>, precio opcional del JSON-LD (WooCommerce).
// Solo se listan competidores con patrón FIABLE (recon 07/07); los de estructura
// dudosa (SPA/mono-oposición/LMS/vocacional) quedan register-only (fila en BD sin
// adapter). Runbook: docs/runbooks/analizador-competidores.md

import { CompetitorAdapter, Modalidad, ParsedCourse, ParsedPrice, UrlType } from './types';
import { jsonLdPrice, nameFromSlug, nameFromTitle } from './_shared';

export interface AcademyConfig {
  key: string;
  name: string;
  baseUrl: string;
  tipo: 'academia_presencial' | 'plataforma_online' | 'hibrida';
  region: string;
  /** Regex sobre el PATH que identifica una hoja de oposición/curso. */
  oposicion: RegExp;
  /** Regex opcional de categoría (informativo). */
  categoria?: RegExp;
  /** Extraer precio del JSON-LD Product/Course (WooCommerce). */
  jsonLdPrice?: boolean;
  modalidad?: Modalidad;
}

export function makeAcademyAdapter(cfg: AcademyConfig): CompetitorAdapter {
  return {
    key: cfg.key,
    name: cfg.name,
    baseUrl: cfg.baseUrl,
    tipo: cfg.tipo,
    region: cfg.region,
    classifyUrl(url: string): UrlType {
      let path: string;
      try {
        path = new URL(url).pathname;
      } catch {
        return 'other';
      }
      if (cfg.oposicion.test(path)) return 'oposicion';
      if (cfg.categoria?.test(path)) return 'categoria';
      return 'page';
    },
    parseCourse(url: string, html: string): ParsedCourse | null {
      const name = nameFromTitle(html) || nameFromSlug(url);
      if (!name) return null;
      const prices: ParsedPrice[] = [];
      if (cfg.jsonLdPrice) {
        const cents = jsonLdPrice(html);
        if (cents != null) {
          prices.push({ kind: 'curso', audience: null, amountCents: cents, period: 'unico', raw: `${cents / 100}€` });
        }
      }
      return { rawName: name, modalidad: cfg.modalidad ?? null, region: null, prices };
    },
  };
}

// Configs verificados por recon 07/07. Precisión > recall en los regex.
export const ACADEMY_CONFIGS: AcademyConfig[] = [
  { key: 'aulaplusformacion', name: 'Aula Plus Formación', baseUrl: 'https://aulaplusformacion.es', tipo: 'academia_presencial', region: 'España',
    oposicion: /^\/tienda\/cursos\/[^/]+\/?$/, jsonLdPrice: true },
  { key: 'masterd', name: 'MasterD Oposiciones', baseUrl: 'https://www.oposicionesmasterd.es', tipo: 'hibrida', region: 'España',
    oposicion: /^\/curso-[a-z0-9-]+$/, categoria: /^\/(cursos|oposiciones-[a-z0-9-]+)$/, modalidad: 'mixta' },
  { key: 'innovaticos', name: 'Innovaticos', baseUrl: 'https://www.innovaticos.com', tipo: 'plataforma_online', region: 'España',
    oposicion: /^\/oposiciones\/[^/]+\/[^/]+\/?$/, categoria: /^\/oposiciones\/[^/]+\/?$/ },
  { key: 'academiatrivium', name: 'Academia Trivium', baseUrl: 'https://www.academiatrivium.com', tipo: 'academia_presencial', region: 'España',
    oposicion: /^\/oposiciones\/[^/]+\/?$/ },
  { key: 'academianota', name: 'Academia Nota', baseUrl: 'https://academianota.com', tipo: 'academia_presencial', region: 'España',
    oposicion: /^\/oposiciones-[a-z0-9-]+\/?$/ },
  { key: 'pacocanete', name: 'Academia Paco Cañete', baseUrl: 'https://pacocanete.com', tipo: 'academia_presencial', region: 'España',
    oposicion: /^\/(oposiciones-[a-z0-9-]+|auxiliar-de-la-administracion-del-estado)\/?$/ },
  { key: 'feslformacion', name: 'FESL Formación', baseUrl: 'https://www.feslformacion.com', tipo: 'academia_presencial', region: 'Murcia',
    oposicion: /^\/oposiciones-[a-z0-9-]+\/?$/ },
  { key: 'atrioposicioneshacienda', name: 'Atrio Oposiciones Hacienda', baseUrl: 'https://www.atrioposicioneshacienda.es', tipo: 'academia_presencial', region: 'España',
    oposicion: /^\/oposiciones-[a-z-]+-hacienda\/?$/ },
  { key: 'administraciondejusticia', name: 'Academia Administración de Justicia', baseUrl: 'https://www.administraciondejusticia.com', tipo: 'academia_presencial', region: 'España',
    oposicion: /^\/producto\/[^/]+\/?$/, categoria: /^\/(tienda|product_cat)/, jsonLdPrice: true },
  { key: 'formaopositores', name: 'Forma Opositores', baseUrl: 'https://formaopositores.com', tipo: 'academia_presencial', region: 'España',
    oposicion: /^\/project\/[^/]+\/?$/ },
  { key: 'cetoposiciones', name: 'CET Oposiciones', baseUrl: 'https://www.cetoposiciones.com', tipo: 'academia_presencial', region: 'España',
    oposicion: /^\/oposiciones\/[^/]+\/[^/]+\/?$/, categoria: /^\/oposiciones\/[^/]+\/?$/ },
];

export const GENERIC_ACADEMY_ADAPTERS: CompetitorAdapter[] = ACADEMY_CONFIGS.map(makeAcademyAdapter);
