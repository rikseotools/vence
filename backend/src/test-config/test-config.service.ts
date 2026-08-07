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
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import {
  articles,
  laws,
  lawSections,
  questions,
} from '../db/schema';
import {
  applyArticleSectionFilter,
  buildOfficialExamFilter,
  getTopicScopeMappings,
  getValidExamPositions,
} from './test-config.helpers';
import { esDegradacion } from './alcance-de-ley';
import { ObservabilityService } from '../observability/observability.service';
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

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly observability: ObservabilityService,
  ) {}

  // ============================================
  // 1. ARTÍCULOS POR LEY
  // ============================================

  async getArticlesForLaw(
    params: GetArticlesRequest,
  ): Promise<GetArticlesResponse> {
    try {
      const { lawShortName, topicNumber, positionType, includeOfficialCount } =
        params;

      // Determinar artículos válidos y law_id según contexto
      let lawId: string;
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
        // ⚠️ Usar el law_id que el topic_scope referencia EXPLÍCITAMENTE (fuente
        // de verdad). Resolver por short_name con LIMIT 1 es ambiguo cuando hay
        // leyes duplicadas (mismo short_name, una poblada y otra vacía, p.ej.
        // "LO 1/2004"): devolvía la vacía → 0 preguntas → todos los artículos en
        // gris en el selector "artículo por artículo".
        if (!mappings[0].lawId) {
          return { success: true, articles: [] };
        }
        lawId = mappings[0].lawId;
        // NULL = ley virtual (incluir todas), [] = skip, [valores] = filtrar
        validArticleNumbers = mappings[0].articleNumbers;
      } else {
        // Sin tema: resolver por short_name. Con leyes duplicadas preferimos
        // DETERMINISTA la fila con más preguntas activas, para no caer en la
        // fila vacía.
        const lawResult = await this.db
          .select({ id: laws.id })
          .from(laws)
          .where(eq(laws.shortName, lawShortName))
          .orderBy(
            sql`(
              SELECT count(*) FROM ${questions} q
              JOIN ${articles} a ON q.primary_article_id = a.id
              WHERE a.law_id = ${laws.id} AND q.is_active = true
            ) DESC`,
            laws.id,
          )
          .limit(1);

        if (!lawResult || lawResult.length === 0) {
          return { success: false, error: `Ley no encontrada: ${lawShortName}` };
        }

        lawId = lawResult[0].id;
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

      // Modo "por leyes" acotado al temario. Con `topicNumber` no aplica: el scope ya lo
      // impone `validArticleNumbers` de arriba. [T-326]
      if (params.scopeToPosition && !topicNumber) {
        articleConditions.push(this.articleInPositionScope(positionType));
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

  /**
   * ¿El artículo `(lawId, articleNumber)` cae en algún `topic_scope` de la oposición?
   *
   * `article_numbers IS NULL` significa "toda la ley" (ley virtual), y por eso NO basta con
   * `= ANY(...)`: en Postgres `x = ANY(NULL)` evalúa a NULL, la fila se descarta y un scope
   * de ley entera contaría 0. Es la misma convención que ya escriben en crudo los otros
   * servicios del backend (`served-coverage`, `auto-promote-coverage`, `canary-theme-stats`)
   * y que en el frontend vive en `lib/api/_shared/topicScopeSql.ts`.
   */
  private articleInPositionScope(positionType: string) {
    return sql`EXISTS (
      SELECT 1
      FROM topic_scope ts
      INNER JOIN topics t ON t.id = ts.topic_id
      WHERE t.position_type = ${positionType}
        AND ts.law_id = ${articles.lawId}
        AND (ts.article_numbers IS NULL OR ${articles.articleNumber} = ANY(ts.article_numbers))
    )`;
  }

  /**
   * ¿Tiene esa oposición ALGUNA fila de `topic_scope` para esa ley?
   *
   * Gemela de `positionHasScopeForLaw` en `lib/api/_shared/topicScopeSql.ts`, para que
   * «sin temario» signifique EXACTAMENTE lo mismo aquí y allí. Es la pregunta que decide
   * si se acota o se degrada ([T-551]); ver `alcance-de-ley.ts`.
   */
  private async positionHasScopeForLaw(
    positionType: string,
    lawId: string,
  ): Promise<boolean> {
    const res = (await this.db.execute(sql`
      SELECT 1
      FROM topic_scope ts
      INNER JOIN topics t ON t.id = ts.topic_id
      WHERE t.position_type = ${positionType}
        AND ts.law_id = ${lawId}
      LIMIT 1
    `)) as { rows?: unknown[] } | unknown[];
    const rows = Array.isArray(res) ? res : (res?.rows ?? []);
    return rows.length > 0;
  }

  /**
   * Estimación en modo "por leyes" (sin tema): cuenta sobre la selección real de leyes,
   * artículos y secciones, con los MISMOS filtros que aplicará el test al servir.
   *
   * Gemelo de `estimateByLaws` en `lib/api/test-config/queries.ts`. Vive aquí porque la
   * familia `test-config` está enrutada al backend y es este camino el que ejecuta
   * producción; tenerlo solo en el frontend fue exactamente el defecto de T-326.
   *
   * El conteo de oficiales usa `getValidExamPositions(positionType)` — solo las oficiales
   * DE ESA oposición, igual que el resto de la app. Contar cross-oposición infla el número
   * sobre leyes compartidas (CE, LOTC…) y haría mentir a la casilla.
   */
  private async estimateByLaws(
    params: EstimateQuestionsRequest,
  ): Promise<EstimateQuestionsResponse> {
    const {
      positionType,
      selectedLaws,
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions,
      difficultyMode,
      scopeToPosition,
      includeSharedOfficials,
    } = params;

    // Sin leyes seleccionadas no hay nada que contar (el configurador aún no ha elegido).
    if (!selectedLaws || selectedLaws.length === 0) {
      return { success: true, count: 0, byLaw: {} };
    }

    const validPositions = onlyOfficialQuestions
      ? getValidExamPositions(positionType)
      : [];
    // Fail-safe: oposición no registrada en EXAM_POSITION_MAP → no tiene oficiales propias.
    // Omitir el filtro contaría las de OTRAS oposiciones y la casilla mentiría — SALVO que
    // `includeSharedOfficials` las pida a propósito ([T-411]): ahí no hay "propias" que
    // exigir, así que este corte no aplica. Gemelo del mismo cambio en el frontend.
    if (
      onlyOfficialQuestions &&
      !includeSharedOfficials &&
      validPositions.length === 0
    ) {
      return { success: true, count: 0, byLaw: {} };
    }

    const byLaw: Record<string, number> = {};
    let totalCount = 0;
    // Leyes en las que se pidió acotar y NO se pudo (oposición sin temario) — se observa al final.
    const degradedLaws: string[] = [];

    for (const lawShortName of selectedLaws) {
      // Con leyes duplicadas se prefiere DETERMINISTA la fila con más preguntas activas,
      // para no caer en la fila vacía (mismo criterio que `getArticlesForLaw`).
      const lawResult = await this.db
        .select({ id: laws.id })
        .from(laws)
        .where(eq(laws.shortName, lawShortName))
        .orderBy(
          sql`(
            SELECT count(*) FROM ${questions} q
            JOIN ${articles} a ON q.primary_article_id = a.id
            WHERE a.law_id = ${laws.id} AND q.is_active = true
          ) DESC`,
          laws.id,
        )
        .limit(1);
      const lawId = lawResult[0]?.id;
      if (!lawId) continue;

      // ¿Acotar al temario, o DEGRADAR? Se decide UNA vez por ley y vale para los DOS
      // sitios que acotan más abajo (el filtro de secciones y el conteo). Decidirlo dos
      // veces es como nació este defecto: dos guardas del mismo recurso que divergen.
      const tieneScopeDeLaLey = scopeToPosition
        ? await this.positionHasScopeForLaw(String(positionType ?? ''), lawId)
        : false;
      const acotarAlTemario = !!scopeToPosition && tieneScopeDeLaLey;
      if (
        esDegradacion({
          acotarAlTemario: !!scopeToPosition,
          tieneScopeDeLaLey,
        })
      ) {
        degradedLaws.push(lawShortName);
      }

      const conditions = [
        eq(questions.isActive, true),
        eq(articles.lawId, lawId),
      ];

      // Artículos elegidos por el usuario para ESTA ley
      const chosen = selectedArticlesByLaw?.[lawShortName];
      let articleNumbers: string[] | null =
        chosen && chosen.length > 0 ? chosen.map((a) => String(a)) : null;

      // Filtros de sección: se resuelven sobre los artículos reales de la ley, con el
      // mismo helper que el modo tema (rangos → números), no con aritmética aparte.
      if (selectedSectionFilters && selectedSectionFilters.length > 0) {
        const candidateConditions = [
          eq(articles.lawId, lawId),
          eq(articles.isActive, true),
        ];
        if (articleNumbers) {
          candidateConditions.push(
            inArray(articles.articleNumber, articleNumbers),
          );
        }
        if (acotarAlTemario) {
          candidateConditions.push(this.articleInPositionScope(positionType));
        }
        const candidates = await this.db
          .select({ articleNumber: articles.articleNumber })
          .from(articles)
          .where(and(...candidateConditions));

        articleNumbers = applyArticleSectionFilter(
          candidates
            .map((c) => c.articleNumber)
            .filter((n): n is string => n != null),
          selectedSectionFilters,
        );
        // Con secciones elegidas y ningún artículo dentro, esta ley aporta 0.
        if (articleNumbers.length === 0) {
          byLaw[lawShortName] = 0;
          continue;
        }
      }

      if (articleNumbers && articleNumbers.length > 0) {
        conditions.push(inArray(articles.articleNumber, articleNumbers));
      }

      // Acotar al temario de la oposición (mismo predicado que el selector de artículos,
      // para que el número y la lista que el usuario ve hablen de lo mismo).
      //
      // …salvo que la oposición NO tenga temario construido para esta ley: entonces se
      // DEGRADA igual que el camino del test, en vez de intersecar contra vacío y devolver
      // 0. Ver `alcance-de-ley.ts` — [T-551].
      if (acotarAlTemario) {
        conditions.push(this.articleInPositionScope(positionType));
      }

      if (onlyOfficialQuestions) {
        conditions.push(eq(questions.isOfficialExam, true));
        // [T-411] Gemelo del mismo corte en el frontend: con includeSharedOfficials no
        // se restringe por exam_position, el filtro de ley/artículo ya acota a ESTA ley.
        if (!includeSharedOfficials) {
          conditions.push(inArray(questions.examPosition, validPositions));
        }
      }

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
      byLaw[lawShortName] = (byLaw[lawShortName] || 0) + count;
      totalCount += count;
    }

    // MISMO eventType que el camino del test y que el gemelo del frontend
    // (`filtered_questions_unbuilt_oposicion_degrade`): un solo evento para un solo
    // fenómeno — qué oposiciones sin construir está usando la gente. Dos emisores del
    // mismo hecho no miden el doble, divergen. `source` sí cambia ('fargate'), que es
    // justo el dato que faltaba para saber QUIÉN sirvió.
    if (degradedLaws.length > 0) {
      this.observability.emitFireAndForget({
        source: 'fargate',
        severity: 'info',
        eventType: 'filtered_questions_unbuilt_oposicion_degrade',
        endpoint: '/api/v2/test-config/estimate',
        metadata: {
          positionType: String(positionType ?? '').slice(0, 80),
          degradedLaws: degradedLaws.slice(0, 20),
          mode: 'estimate',
        },
      });
    }

    return { success: true, count: totalCount, byLaw };
  }

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

      // Sin tema = configurador "por leyes": no hay topic_scope del que partir, pero SÍ se
      // puede contar, porque la selección son leyes + artículos. Hace falta para que la
      // casilla "🏛️ Preguntas oficiales" pueda pintarse ahí con un número honesto — T-326.
      //
      // ⚠️ Esta rama existía SOLO en el frontend (`lib/api/test-config/queries.ts`) y por eso
      // el arreglo llegó a producción INERTE: la familia `test-config` está enrutada al
      // backend, así que el camino que se ejecuta es ÉSTE y seguía contestando el error de
      // abajo. La paridad la vigila `__tests__/guardrails/estimateByLawsParidad.test.ts`.
      if (!topicNumber) {
        return this.estimateByLaws(params);
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

        // [T-507 / T-566] Los dos filtros que el serve aplica SIEMPRE y que esta
        // estimación no aplicaba, así que prometía preguntas que el test no da:
        //   · oficiales de OTRA oposición (buildOfficialExamFilter, caso Laura)
        //   · supuestos prácticos (sin su contexto narrativo no se sirven en tests)
        // Van al final para cubrir también la rama focusEssentialArticles, que
        // reconstruye `conditions` desde cero. Ya vive en el frontend
        // (`lib/api/test-config/queries.ts`) desde T-507; nunca llegó a este
        // gemelo, que es el que producción ejecuta (`test-config` → backend).
        conditions.push(isNull(questions.examCaseId));
        conditions.push(buildOfficialExamFilter(positionType));

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
