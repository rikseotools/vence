// test-config.helpers.ts — Helpers puros para test-config.service.
// Portados desde:
//   - frontend lib/api/test-config/queries.ts (applyArticleSectionFilter,
//     getTopicScopeMappings)
//   - frontend lib/config/exam-positions.ts (EXAM_POSITION_MAP,
//     getValidExamPositions)
//
// No tienen estado ni dependencias de NestJS — son funciones puras o queries
// que reciben el cliente `db` como parámetro.

import { and, eq } from 'drizzle-orm';
import type { DrizzleDB } from '../db/database.module';
import { laws, topicScope, topics } from '../db/schema';
import type { SectionFilter } from './test-config.types';

// ============================================
// EXAM POSITIONS (frontend lib/config/exam-positions.ts)
// ============================================

/**
 * Mapeo: positionType → valores válidos de exam_position en la tabla questions.
 * Las preguntas oficiales se marcan con exam_position al importar.
 *
 * Sincronizar con frontend `lib/config/exam-positions.ts`.
 */
export const EXAM_POSITION_MAP: Record<string, string[]> = {
  auxiliar_administrativo_estado: [
    'auxiliar administrativo del estado',
    'auxiliar administrativo',
    'auxiliar_administrativo',
    'auxiliar_administrativo_estado',
  ],
  auxiliar_administrativo_madrid: [
    'auxiliar_administrativo_madrid',
    'auxiliar administrativo madrid',
    'auxiliar administrativo comunidad de madrid',
  ],
  administrativo_estado: [
    'administrativo',
    'administrativo_estado',
    'cuerpo_general_administrativo',
    'cuerpo general administrativo de la administración del estado',
  ],
  gestion_administracion_civil: [
    'cuerpo_gestion_administracion_civil',
    'cuerpo de gestión de la administración civil del estado',
  ],
  administrativo_seguridad_social: [
    'administrativo_seguridad_social',
    'administrativo de la administración de la seguridad social',
    'cuerpo administrativo de la administración de la seguridad social',
  ],
  tramitacion_procesal: ['tramitacion_procesal', 'tramitación procesal'],
  auxiliar_administrativo_cyl: [
    'auxiliar_administrativo_cyl',
    'auxiliar administrativo castilla y leon',
    'auxiliar administrativo cyl',
  ],
  auxiliar_administrativo_extremadura: [
    'auxiliar_administrativo_extremadura',
    'auxiliar administrativo extremadura',
    'auxiliar administrativo junta de extremadura',
    'cuerpo auxiliar administracion comunidad autonoma extremadura',
  ],
  auxiliar_administrativo_canarias: [
    'auxiliar_administrativo_canarias',
    'auxiliar administrativo canarias',
    'auxiliar administrativo gobierno de canarias',
    'cuerpo auxiliar administracion publica comunidad autonoma canarias',
  ],
  auxilio_judicial: ['auxilio_judicial', 'auxilio judicial'],
  gestion_procesal: ['gestion_procesal', 'gestión procesal'],
  auxiliar_administrativo_andalucia: [
    'auxiliar_administrativo_andalucia',
    'auxiliar administrativo andalucia',
  ],
  auxiliar_administrativo_carm: [
    'auxiliar_administrativo_carm',
    'auxiliar administrativo carm',
    'auxiliar administrativo murcia',
  ],
  auxiliar_administrativo_valencia: [
    'auxiliar_administrativo_valencia',
    'auxiliar administrativo valencia',
    'auxiliar administrativo generalitat valenciana',
    'auxiliar administrativo gva',
  ],
  administrativo_diputacion_valencia: [
    'administrativo_diputacion_valencia',
    'administrativo diputacion valencia',
    'administrativo dival',
  ],
  auxiliar_administrativo_ayuntamiento_valencia: [
    'auxiliar_administrativo_ayuntamiento_valencia',
    'auxiliar administrativo ayuntamiento valencia',
  ],
  administrativo_gva: [
    'administrativo_gva',
    'administrativo gva',
    'administrativo generalitat valenciana',
    'administrativo c1-01 gva',
    'cuerpo administrativo c1-01',
  ],
  guardia_civil: ['guardia_civil', 'guardia civil', 'escala cabos y guardias'],
  policia_nacional: [
    'policia_nacional',
    'policía nacional',
    'policia nacional',
    'escala basica policia nacional',
  ],
  auxiliar_administrativo_scs_canarias: [
    'auxiliar_administrativo_scs_canarias',
    'auxiliar administrativo scs canarias',
    'auxiliar administrativo servicio canario de la salud',
    'grupo auxiliar administrativo de la funcion administrativa',
  ],
  auxiliar_administrativo_clm: [
    'auxiliar_administrativo_clm',
    'auxiliar administrativo clm',
    'auxiliar administrativo castilla-la mancha',
  ],
  auxiliar_administrativo_ayuntamiento_zaragoza: [
    'auxiliar_administrativo_ayuntamiento_zaragoza',
    'auxiliar administrativo ayuntamiento zaragoza',
  ],
  auxiliar_administrativo_diputacion_zaragoza: [],
  auxiliar_administrativo_sermas: [],
  tcae_sermas_madrid: [],
  administrativo_galicia: [],
  auxiliar_administrativo_aragon: [],
  auxiliar_administrativo_catalunya: [],
  auxiliar_administrativo_pais_vasco: [],
};

/**
 * Obtiene los valores válidos de exam_position para un positionType.
 * Normaliza el input (lowercase, guiones → underscores).
 */
export function getValidExamPositions(positionType: string): string[] {
  if (!positionType) return [];
  const normalized = positionType.toLowerCase().replace(/-/g, '_');
  return EXAM_POSITION_MAP[normalized] || [];
}

// ============================================
// HELPER: Filtro de artículos por secciones
// ============================================

/**
 * Filtra una lista de article numbers por los rangos declarados en los
 * sectionFilters. Si no hay filtros (o ninguno tiene articleRange), devuelve
 * la lista sin cambios.
 */
export function applyArticleSectionFilter(
  articleNumbers: string[],
  sectionFilters: SectionFilter[],
): string[] {
  if (!sectionFilters || sectionFilters.length === 0) {
    return articleNumbers;
  }

  const ranges = sectionFilters
    .filter((s) => s.articleRange)
    .map((s) => ({
      start: s.articleRange!.start,
      end: s.articleRange!.end,
    }));

  if (ranges.length === 0) {
    return articleNumbers;
  }

  return articleNumbers.filter((articleNum) => {
    const num = parseInt(articleNum, 10);
    if (isNaN(num)) return false;
    return ranges.some((range) => num >= range.start && num <= range.end);
  });
}

// ============================================
// HELPER: Obtener topic_scope mappings
// ============================================

export interface TopicScopeMapping {
  articleNumbers: string[] | null;
  lawId: string | null;
  lawShortName: string | null;
}

/**
 * Devuelve los mappings de topic_scope para un (topicNumber, positionType),
 * opcionalmente filtrado por `lawShortName`.
 *
 * - `articleNumbers === null` → ley virtual (cubre todos los artículos).
 * - `articleNumbers === []`   → ley presente pero sin artículos asignados.
 * - `articleNumbers === [...]` → set específico de artículos.
 */
export async function getTopicScopeMappings(
  db: DrizzleDB,
  topicNumber: number,
  positionType: string,
  lawShortName?: string,
): Promise<TopicScopeMapping[]> {
  const conditions = [
    eq(topics.topicNumber, topicNumber),
    eq(topics.positionType, positionType),
  ];

  if (lawShortName) {
    conditions.push(eq(laws.shortName, lawShortName));
  }

  return db
    .select({
      articleNumbers: topicScope.articleNumbers,
      lawId: topicScope.lawId,
      lawShortName: laws.shortName,
    })
    .from(topicScope)
    .innerJoin(topics, eq(topicScope.topicId, topics.id))
    .innerJoin(laws, eq(topicScope.lawId, laws.id))
    .where(and(...conditions));
}
