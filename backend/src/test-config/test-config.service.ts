// test-config.service.ts — Queries Drizzle para el configurador de tests.
//
// Portado desde el frontend `lib/api/test-config/queries.ts`:
//   - getArticlesForLaw
//   - estimateAvailableQuestions
//   - getEssentialArticles
//   - getScopedLawSections
//
// Los wrappers `unstable_cache` del frontend NO se portan: en el backend la
// capa de caché vivirá en el Controller/Interceptor o en un cache module
// dedicado (Redis/in-memory). Estas funciones son uncached y deterministas.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  articles,
  laws,
  lawSections,
  questions,
} from '../db/schema';
import {
  applyArticleSectionFilter,
  getTopicScopeMappings,
  getValidExamPositions,
} from './test-config.helpers';
import type {
  EstimateQuestionsRequest,
  EstimateQuestionsResponse,
  GetArticlesRequest,
  GetArticlesResponse,
  GetEssentialArticlesRequest,
  GetEssentialArticlesResponse,
  GetScopedSectionsRequest,
  GetScopedSectionsResponse,
  ScopedLawSection,
} from './test-config.types';

@Injectable()
export class TestConfigService {
  private readonly logger = new Logger(TestConfigService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ============================================
  // 1. ARTÍCULOS POR LEY
  // ============================================

  async getArticlesForLaw(
    params: GetArticlesRequest,
  ): Promise<GetArticlesResponse> {
    try {
      const { lawShortName, topicNumber, positionType, includeOfficialCount } =
        params;

      // Buscar law_id
      const lawResult = await this.db
        .select({ id: laws.id })
        .from(laws)
        .where(eq(laws.shortName, lawShortName))
        .limit(1);

      if (!lawResult || lawResult.length === 0) {
        return { success: false, error: `Ley no encontrada: ${lawShortName}` };
      }

      const lawId = lawResult[0].id;

      // Determinar artículos válidos según contexto
      let validArticleNumbers: string[] | null = null;

      if (topicNumber) {
        // Modo tema: filtrar por topic_scope
        const mappings = await getTopicScopeMappings(
          this.db,
          topicNumber,
          positionType,
          lawShortName,
        );
        if (!mappings || mappings.length === 0) {
          return { success: true, articles: [] };
        }
        // NULL = ley virtual (incluir todas), [] = skip, [valores] = filtrar
        validArticleNumbers = mappings[0].articleNumbers;
      }

      // Query: artículos con conteo de preguntas (LEFT JOIN para incluir
      // artículos sin preguntas).
      const articleConditions = [
        eq(articles.lawId, lawId),
        eq(articles.isActive, true),
      ];

      if (validArticleNumbers && validArticleNumbers.length > 0) {
        articleConditions.push(
          inArray(articles.articleNumber, validArticleNumbers),
        );
      }

      const articleData = await this.db
        .select({
          articleNumber: articles.articleNumber,
          title: articles.title,
          questionCount: sql<number>`count(${questions.id})`,
        })
        .from(articles)
        .leftJoin(
          questions,
          and(
            eq(questions.primaryArticleId, articles.id),
            eq(questions.isActive, true),
          ),
        )
        .where(and(...articleConditions))
        .groupBy(articles.articleNumber, articles.title)
        .orderBy(
          sql`NULLIF(regexp_replace(${articles.articleNumber}, '[^0-9]', '', 'g'), '')::int NULLS LAST, ${articles.articleNumber} NULLS LAST`,
        );

      // Construir resultado
      const result = articleData.map((row) => ({
        article_number: row.articleNumber as string,
        title: row.title,
        question_count: Number(row.questionCount),
        ...(includeOfficialCount ? { official_question_count: 0 } : {}),
      }));

      // Si se piden conteos oficiales, hacer query adicional
      if (includeOfficialCount) {
        const validPositions = getValidExamPositions(positionType);

        const officialConditions = [
          eq(questions.isActive, true),
          eq(questions.isOfficialExam, true),
          eq(articles.lawId, lawId),
        ];

        if (validArticleNumbers && validArticleNumbers.length > 0) {
          officialConditions.push(
            inArray(articles.articleNumber, validArticleNumbers),
          );
        }

        // Fail-safe: oposición no registrada en EXAM_POSITION_MAP → forzar 0 oficiales (filtro
        // imposible) en vez de contar oficiales de otras oposiciones (bug Seg. Social).
        officialConditions.push(
          inArray(
            questions.examPosition,
            validPositions.length > 0 ? validPositions : ['__none__'],
          ),
        );

        const officialData = await this.db
          .select({
            articleNumber: articles.articleNumber,
            officialCount: sql<number>`count(${questions.id})`,
          })
          .from(questions)
          .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
          .where(and(...officialConditions))
          .groupBy(articles.articleNumber);

        const officialMap = new Map(
          officialData.map((row) => [
            row.articleNumber,
            Number(row.officialCount),
          ]),
        );

        for (const article of result) {
          article.official_question_count =
            officialMap.get(String(article.article_number)) || 0;
        }
      }

      return { success: true, articles: result };
    } catch (error) {
      this.logger.error(
        'Error obteniendo artículos para ley',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  // ============================================
  // 2. ESTIMACIÓN DE PREGUNTAS DISPONIBLES
  // ============================================

  async estimateAvailableQuestions(
    params: EstimateQuestionsRequest,
  ): Promise<EstimateQuestionsResponse> {
    try {
      const {
        topicNumber,
        positionType,
        selectedLaws,
        selectedArticlesByLaw,
        selectedSectionFilters,
        onlyOfficialQuestions,
        difficultyMode,
        focusEssentialArticles,
      } = params;

      // Si no hay tema, no podemos estimar (necesitamos topic_scope)
      if (!topicNumber) {
        return {
          success: false,
          error: 'topicNumber es requerido para estimar',
        };
      }

      // 1. Obtener topic_scope
      const topicScopeResults = await getTopicScopeMappings(
        this.db,
        topicNumber,
        positionType,
      );

      if (!topicScopeResults || topicScopeResults.length === 0) {
        return {
          success: false,
          error: `No se encontró mapeo para tema ${topicNumber}`,
        };
      }

      // 2. Aplicar filtros de leyes
      let filteredMappings = topicScopeResults;
      if (selectedLaws && selectedLaws.length > 0) {
        filteredMappings = filteredMappings.filter(
          (m) => m.lawShortName && selectedLaws.includes(m.lawShortName),
        );
      }

      // 3. Aplicar filtros de artículos
      if (
        selectedArticlesByLaw &&
        Object.keys(selectedArticlesByLaw).length > 0
      ) {
        filteredMappings = filteredMappings
          .map((mapping) => {
            const lawShortName = mapping.lawShortName;
            if (!lawShortName) return mapping;
            const selectedArticles = selectedArticlesByLaw[lawShortName];
            if (selectedArticles && selectedArticles.length > 0) {
              const selectedArticlesAsStrings = selectedArticles.map((num) =>
                String(num),
              );
              const filteredArticleNumbers = (
                mapping.articleNumbers || []
              ).filter((articleNum) =>
                selectedArticlesAsStrings.includes(String(articleNum)),
              );
              return { ...mapping, articleNumbers: filteredArticleNumbers };
            }
            return mapping;
          })
          .filter((m) => m.articleNumbers && m.articleNumbers.length > 0);
      }

      // 4. Aplicar filtros de secciones
      if (selectedSectionFilters && selectedSectionFilters.length > 0) {
        filteredMappings = filteredMappings
          .map((mapping) => {
            const filteredArticleNumbers = applyArticleSectionFilter(
              mapping.articleNumbers || [],
              selectedSectionFilters,
            );
            return { ...mapping, articleNumbers: filteredArticleNumbers };
          })
          .filter((m) => m.articleNumbers && m.articleNumbers.length > 0);
      }

      // 5. Contar preguntas por ley
      const byLaw: Record<string, number> = {};
      let totalCount = 0;

      for (const mapping of filteredMappings) {
        // articleNumbers NULL = ley virtual (incluir TODAS las preguntas)
        // articleNumbers []   = sin artículos específicos → SKIP
        // articleNumbers [..] = filtrar solo esos artículos
        if (
          mapping.articleNumbers !== null &&
          mapping.articleNumbers.length === 0
        )
          continue;

        const hasSpecificArticles =
          mapping.articleNumbers && mapping.articleNumbers.length > 0;

        // Construir condiciones de la query
        const conditions = [
          eq(questions.isActive, true),
          eq(articles.lawId, mapping.lawId!),
          ...(hasSpecificArticles
            ? [inArray(articles.articleNumber, mapping.articleNumbers!)]
            : []),
        ];

        // Filtro de preguntas oficiales por oposición
        if (onlyOfficialQuestions || focusEssentialArticles) {
          const validPositions = getValidExamPositions(positionType);

          // Fail-safe: oposición no registrada en EXAM_POSITION_MAP → 0 oficiales (no omitir el
          // filtro, que contaría oficiales de otras oposiciones y mentiría: 94 vs 1 real).
          if (validPositions.length === 0) continue;

          if (focusEssentialArticles) {
            // Solo artículos que tengan al menos 1 pregunta oficial.
            const officialConditions = [
              eq(questions.isActive, true),
              eq(questions.isOfficialExam, true),
              eq(articles.lawId, mapping.lawId!),
              ...(hasSpecificArticles
                ? [inArray(articles.articleNumber, mapping.articleNumbers!)]
                : []),
            ];

            if (validPositions.length > 0) {
              officialConditions.push(
                inArray(questions.examPosition, validPositions),
              );
            }

            const essentialArticleNums = await this.db
              .select({ articleNumber: articles.articleNumber })
              .from(questions)
              .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
              .where(and(...officialConditions))
              .groupBy(articles.articleNumber);

            const essentialNums = essentialArticleNums
              .map((r) => r.articleNumber)
              .filter((n): n is string => n !== null);
            if (essentialNums.length === 0) continue;

            // Reemplazar el filtro de artículos con solo los esenciales.
            conditions.length = 0;
            conditions.push(
              eq(questions.isActive, true),
              eq(articles.lawId, mapping.lawId!),
              inArray(articles.articleNumber, essentialNums),
            );
          } else {
            // Solo preguntas oficiales
            conditions.push(eq(questions.isOfficialExam, true));
            if (validPositions.length > 0) {
              conditions.push(inArray(questions.examPosition, validPositions));
            }
          }
        }

        // Filtro de dificultad: prioriza global_difficulty_category (datos
        // reales); fallback a difficulty (legacy) si NULL. Mismo patrón que
        // random-test y filtered-questions. Asegura que el conteo del
        // configurador coincida con las preguntas reales que devolverá la
        // query de filtered-questions.
        if (
          difficultyMode &&
          difficultyMode !== 'random' &&
          difficultyMode !== 'adaptive'
        ) {
          conditions.push(
            sql`(${questions.globalDifficultyCategory} = ${difficultyMode} OR
                (${questions.globalDifficultyCategory} IS NULL AND ${questions.difficulty} = ${difficultyMode}))`,
          );
        }

        const countResult = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(questions)
          .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
          .where(and(...conditions));

        const count = Number(countResult[0]?.count || 0);
        if (mapping.lawShortName) {
          byLaw[mapping.lawShortName] =
            (byLaw[mapping.lawShortName] || 0) + count;
        }
        totalCount += count;
      }

      return {
        success: true,
        count: totalCount,
        byLaw,
      };
    } catch (error) {
      this.logger.error(
        'Error estimando preguntas disponibles',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  // ============================================
  // 3. ARTÍCULOS IMPRESCINDIBLES
  // ============================================

  async getEssentialArticles(
    params: GetEssentialArticlesRequest,
  ): Promise<GetEssentialArticlesResponse> {
    try {
      const { topicNumber, positionType } = params;

      // 1. Obtener topic_scope
      const topicScopeResults = await getTopicScopeMappings(
        this.db,
        topicNumber,
        positionType,
      );

      if (!topicScopeResults || topicScopeResults.length === 0) {
        return {
          success: false,
          error: `No se encontró mapeo para tema ${topicNumber}`,
        };
      }

      const validPositions = getValidExamPositions(positionType);
      const essentialArticles: Array<{
        number: string | number;
        law: string;
        questionsCount: number;
      }> = [];
      let totalQuestions = 0;
      const byDifficulty: Record<string, number> = {};

      // Fail-safe: si la oposición no está registrada en EXAM_POSITION_MAP, validPositions=[].
      // Devolver 0 imprescindibles en vez de contar oficiales de otras oposiciones (bug Seg.
      // Social: Tema 2 mostraba 94 oficiales cross-oposición frente a 1 real).
      if (validPositions.length === 0) {
        return {
          success: true,
          essentialCount: 0,
          essentialArticles: [],
          totalQuestions: 0,
          byDifficulty: {},
        };
      }

      // 2. Para cada ley, encontrar artículos con preguntas oficiales
      for (const mapping of topicScopeResults) {
        // NULL = ley virtual (incluir todas), [] = skip, [valores] = filtrar
        if (
          mapping.articleNumbers !== null &&
          mapping.articleNumbers.length === 0
        )
          continue;
        if (!mapping.lawShortName) continue;

        const hasSpecificArticles =
          mapping.articleNumbers && mapping.articleNumbers.length > 0;

        // Query: artículos con al menos 1 pregunta oficial (agrupado)
        const officialConditions = [
          eq(questions.isActive, true),
          eq(questions.isOfficialExam, true),
          eq(articles.lawId, mapping.lawId!),
          ...(hasSpecificArticles
            ? [inArray(articles.articleNumber, mapping.articleNumbers!)]
            : []),
        ];

        if (validPositions.length > 0) {
          officialConditions.push(
            inArray(questions.examPosition, validPositions),
          );
        }

        const articlesWithOfficial = await this.db
          .select({
            articleNumber: articles.articleNumber,
            officialCount: sql<number>`count(${questions.id})`,
          })
          .from(questions)
          .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
          .where(and(...officialConditions))
          .groupBy(articles.articleNumber);

        if (articlesWithOfficial.length === 0) continue;

        const essentialNums = articlesWithOfficial
          .map((r) => r.articleNumber)
          .filter((n): n is string => n !== null);
        if (essentialNums.length === 0) continue;

        // Añadir a la lista de artículos imprescindibles
        for (const row of articlesWithOfficial) {
          if (row.articleNumber == null) continue;
          essentialArticles.push({
            number: row.articleNumber,
            law: mapping.lawShortName,
            questionsCount: Number(row.officialCount),
          });
        }

        // 3. Contar TODAS las preguntas de artículos imprescindibles
        //    (no solo oficiales)
        const totalCountResult = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(questions)
          .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
          .where(
            and(
              eq(questions.isActive, true),
              eq(articles.lawId, mapping.lawId!),
              inArray(articles.articleNumber, essentialNums),
            ),
          );

        totalQuestions += Number(totalCountResult[0]?.count || 0);

        // 4. Desglose por dificultad
        const difficultyResult = await this.db
          .select({
            difficulty: questions.difficulty,
            count: sql<number>`count(*)`,
          })
          .from(questions)
          .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
          .where(
            and(
              eq(questions.isActive, true),
              eq(articles.lawId, mapping.lawId!),
              inArray(articles.articleNumber, essentialNums),
            ),
          )
          .groupBy(questions.difficulty);

        for (const row of difficultyResult) {
          const difficulty = row.difficulty || 'unknown';
          byDifficulty[difficulty] =
            (byDifficulty[difficulty] || 0) + Number(row.count);
        }
      }

      return {
        success: true,
        essentialCount: essentialArticles.length,
        essentialArticles,
        totalQuestions,
        byDifficulty,
      };
    } catch (error) {
      this.logger.error(
        'Error obteniendo artículos imprescindibles',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  // ============================================
  // 4. SECCIONES (TÍTULOS/CAPÍTULOS) CON SCOPE DE TEMA
  // ============================================
  //
  // Devuelve todas las secciones (law_sections) de una ley enriquecidas con
  // metadatos de intersección con topic_scope del tema indicado. Esto
  // permite al configurador (cuando opera dentro de un tema) mostrar sólo
  // los títulos que realmente contienen artículos dentro del scope —
  // evitando que el usuario seleccione títulos que darían 0 preguntas.
  //
  // Los títulos fuera de scope no se eliminan: se devuelven con
  // articleCountInScope=0 para que el frontend pueda mostrarlos
  // deshabilitados y explicar por qué.

  async getScopedLawSections(
    params: GetScopedSectionsRequest,
  ): Promise<GetScopedSectionsResponse> {
    try {
      const { lawShortName, topicNumber, positionType } = params;

      // 1. Resolver law_id (buscar ley activa por short_name)
      const lawResult = await this.db
        .select({ id: laws.id })
        .from(laws)
        .where(and(eq(laws.shortName, lawShortName), eq(laws.isActive, true)))
        .limit(1);

      if (!lawResult || lawResult.length === 0) {
        return { success: false, error: `Ley no encontrada: ${lawShortName}` };
      }

      const lawId = lawResult[0].id;

      // 2. Obtener topic_scope para esta ley+tema
      //    - null = ley virtual (incluye TODOS los artículos)
      //    - []   = ley presente pero sin artículos asignados (caso raro)
      //    - [...] = set específico de artículos
      const mappings = await getTopicScopeMappings(
        this.db,
        topicNumber,
        positionType,
        lawShortName,
      );

      if (!mappings || mappings.length === 0) {
        // La ley no pertenece al scope del tema → sin secciones útiles
        return { success: true, sections: [], totalInScope: 0 };
      }

      const scopeArticleNumbers: string[] | null = mappings[0].articleNumbers;

      // 3. Obtener secciones activas de la ley (Drizzle)
      const sections = await this.db
        .select({
          id: lawSections.id,
          slug: lawSections.slug,
          title: lawSections.title,
          description: lawSections.description,
          articleRangeStart: lawSections.articleRangeStart,
          articleRangeEnd: lawSections.articleRangeEnd,
          sectionNumber: lawSections.sectionNumber,
          sectionType: lawSections.sectionType,
          orderPosition: lawSections.orderPosition,
        })
        .from(lawSections)
        .where(
          and(eq(lawSections.lawId, lawId), eq(lawSections.isActive, true)),
        )
        .orderBy(lawSections.orderPosition);

      // 4. Enriquecer con intersección con topic_scope
      //    Si scopeArticleNumbers === null → ley virtual, todos los
      //      artículos cuentan.
      //    Si scopeArticleNumbers === []   → ningún artículo,
      //      scopeMeta = 0 para todo.
      //    Si scopeArticleNumbers tiene valores → interseccionar por rango.
      const enriched: ScopedLawSection[] = sections.map((s) => {
        const hasRange =
          s.articleRangeStart != null && s.articleRangeEnd != null;
        let articlesInScope: string[] = [];

        if (hasRange) {
          if (scopeArticleNumbers === null) {
            // Ley virtual: no tenemos lista explícita — tratamos como
            // "todos en rango" pero no podemos enumerar artículos sin
            // consultar la tabla articles. Devolvemos el propio rango como
            // placeholder (count > 0 suficiente). Es seguro porque en el
            // pipeline de filtros la ley virtual siempre pasa.
            articlesInScope = [];
          } else {
            articlesInScope = scopeArticleNumbers.filter((a) => {
              const n = parseInt(a, 10);
              if (isNaN(n)) return false;
              return n >= s.articleRangeStart! && n <= s.articleRangeEnd!;
            });
          }
        }

        // Para leyes virtuales, consideramos toda sección con rango como
        // "en scope".
        const countInScope =
          scopeArticleNumbers === null && hasRange
            ? Math.max(0, s.articleRangeEnd! - s.articleRangeStart! + 1)
            : articlesInScope.length;

        return {
          id: s.id,
          slug: s.slug,
          title: s.title,
          description: s.description,
          articleRange: hasRange
            ? { start: s.articleRangeStart!, end: s.articleRangeEnd! }
            : null,
          sectionNumber: s.sectionNumber,
          sectionType: s.sectionType,
          orderPosition: s.orderPosition,
          scopeMeta: {
            articlesInScope,
            articleCountInScope: countInScope,
          },
        };
      });

      const totalInScope = enriched.filter(
        (s) => s.scopeMeta.articleCountInScope > 0,
      ).length;

      // Telemetría estructurada: si hay secciones pero ninguna útil,
      // probable tema mal mapeado o ley con un único artículo fuera de los
      // títulos. No es un error — sólo una señal que monitorizamos.
      if (enriched.length > 0 && totalInScope === 0) {
        this.logger.warn(
          `[getScopedLawSections] ${lawShortName} tema ${topicNumber}/${positionType}: ` +
            `${enriched.length} secciones, 0 con artículos en scope. ` +
            'El botón Títulos quedará oculto para este caso.',
        );
      } else {
        this.logger.log(
          `[getScopedLawSections] ${lawShortName} tema ${topicNumber}/${positionType}: ` +
            `${totalInScope}/${enriched.length} secciones útiles en scope`,
        );
      }

      return {
        success: true,
        sections: enriched,
        totalInScope,
      };
    } catch (error) {
      this.logger.error(
        'Error obteniendo secciones con scope de tema',
        error instanceof Error ? error.stack : String(error),
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}
