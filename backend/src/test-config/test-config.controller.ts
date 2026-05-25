import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CacheService } from '../cache/cache.service';
import { CacheVersioningService } from '../cache/cache-versioning.service';
import { TestConfigService } from './test-config.service';
import type {
  EstimateQuestionsRequest,
  GetArticlesRequest,
  GetEssentialArticlesRequest,
  GetScopedSectionsRequest,
  SectionFilter,
} from './test-config.types';

/**
 * GET /api/v2/test-config/{articles,sections,essential-articles,estimate}
 *
 * Espejo de los 4 endpoints Vercel `app/api/v2/test-config/*`. Sin auth.
 *
 * Cache versionado tag-like (CacheVersioningService):
 *   - Tag 'test-config' compartido con frontend (`lib/cache/test-config.ts`
 *     hace INCR en `cache_version:test-config` desde admin lifecycle).
 *   - Cada cache key incluye la versión actual: invalida todo el tag con
 *     1 INCR atómico cuando admin modifica datos.
 *   - Cross-runtime coherente — backend y Vercel leen el mismo contador
 *     Upstash. Cuando admin invalida, backend ve la nueva versión en ≤1s.
 *
 * TTLs por endpoint (idénticos al frontend Next.js `unstable_cache`):
 *   - articles:         6h
 *   - sections:         6h
 *   - essential-articles: 24h
 *   - estimate:         1h
 */
const TTL = {
  articles: 6 * 60 * 60,
  sections: 6 * 60 * 60,
  essentialArticles: 24 * 60 * 60,
  estimate: 1 * 60 * 60,
} as const;

const TAG = 'test-config';

@Controller('api/v2/test-config')
export class TestConfigController {
  private readonly logger = new Logger(TestConfigController.name);

  constructor(
    private readonly service: TestConfigService,
    private readonly cache: CacheService,
    private readonly versioning: CacheVersioningService,
  ) {}

  // ────────────────────────────────────────────
  // GET /articles
  // ────────────────────────────────────────────
  @Get('articles')
  async articles(
    @Query() query: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const lawShortName = query.lawShortName;
    const positionType = query.positionType;
    if (!lawShortName || !positionType) {
      res.status(400);
      return { success: false, error: 'lawShortName and positionType required' };
    }
    const params: GetArticlesRequest = {
      lawShortName,
      topicNumber: query.topicNumber ? Number(query.topicNumber) : null,
      positionType,
      includeOfficialCount: query.includeOfficialCount === 'true',
    };

    const subKey = `articles:${params.lawShortName}:t${params.topicNumber ?? 'all'}:p${params.positionType}:o${params.includeOfficialCount ? '1' : '0'}`;
    return this.servedCached(subKey, TTL.articles, res, () =>
      this.service.getArticlesForLaw(params),
    );
  }

  // ────────────────────────────────────────────
  // GET /sections
  // ────────────────────────────────────────────
  @Get('sections')
  async sections(
    @Query() query: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const lawShortName = query.lawShortName;
    const positionType = query.positionType;
    const topicNumberRaw = query.topicNumber;
    if (!lawShortName || !positionType || !topicNumberRaw) {
      res.status(400);
      return {
        success: false,
        error: 'lawShortName, positionType and topicNumber required',
      };
    }
    const params: GetScopedSectionsRequest = {
      lawShortName,
      topicNumber: Number(topicNumberRaw),
      positionType,
    };

    const subKey = `sections:${params.lawShortName}:t${params.topicNumber}:p${params.positionType}`;
    return this.servedCached(subKey, TTL.sections, res, () =>
      this.service.getScopedLawSections(params),
    );
  }

  // ────────────────────────────────────────────
  // GET /essential-articles
  // ────────────────────────────────────────────
  @Get('essential-articles')
  async essentialArticles(
    @Query() query: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const positionType = query.positionType;
    const topicNumberRaw = query.topicNumber;
    if (!positionType || !topicNumberRaw) {
      res.status(400);
      return { success: false, error: 'topicNumber and positionType required' };
    }
    const params: GetEssentialArticlesRequest = {
      topicNumber: Number(topicNumberRaw),
      positionType,
    };

    const subKey = `essential:t${params.topicNumber}:p${params.positionType}`;
    return this.servedCached(subKey, TTL.essentialArticles, res, () =>
      this.service.getEssentialArticles(params),
    );
  }

  // ────────────────────────────────────────────
  // GET /estimate
  // ────────────────────────────────────────────
  @Get('estimate')
  async estimate(
    @Query() query: Record<string, string | undefined>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<unknown> {
    const positionType = query.positionType;
    if (!positionType) {
      res.status(400);
      return { success: false, error: 'positionType required' };
    }

    // Params complejos JSON en query string (mismo formato que Vercel)
    let selectedArticlesByLaw: Record<string, (number | string)[]> = {};
    let selectedSectionFilters: SectionFilter[] = [];

    try {
      const sab = query.selectedArticlesByLaw;
      if (sab) selectedArticlesByLaw = JSON.parse(sab);
    } catch {
      /* ignorar JSON inválido — equivalente al endpoint Vercel */
    }

    try {
      const ssf = query.selectedSectionFilters;
      if (ssf) selectedSectionFilters = JSON.parse(ssf);
    } catch {
      /* idem */
    }

    const selectedLawsRaw = query.selectedLaws ?? '';
    const selectedLaws = selectedLawsRaw ? selectedLawsRaw.split(',') : [];

    const params: EstimateQuestionsRequest = {
      topicNumber: query.topicNumber ? Number(query.topicNumber) : null,
      positionType,
      selectedLaws,
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions: query.onlyOfficialQuestions === 'true',
      difficultyMode: (query.difficultyMode ?? 'random') as EstimateQuestionsRequest['difficultyMode'],
      focusEssentialArticles: query.focusEssentialArticles === 'true',
    };

    // Cache key normalizado: ordenar arrays para que ?l=A,B&l=B,A → mismo hit.
    const lawsKey = [...selectedLaws].sort().join(',');
    const articlesKey = Object.keys(selectedArticlesByLaw)
      .sort()
      .map((k) => `${k}:${(selectedArticlesByLaw[k] ?? []).slice().sort().join('|')}`)
      .join(';');
    const sectionsKey = JSON.stringify(selectedSectionFilters); // ya estable
    const subKey = `estimate:t${params.topicNumber ?? 'all'}:p${params.positionType ?? 'any'}:l${lawsKey}:a${articlesKey}:s${sectionsKey}:o${params.onlyOfficialQuestions ? '1' : '0'}:d${params.difficultyMode}:e${params.focusEssentialArticles ? '1' : '0'}`;

    return this.servedCached(subKey, TTL.estimate, res, () =>
      this.service.estimateAvailableQuestions(params),
    );
  }

  // ────────────────────────────────────────────
  // Helper común: cache versionado
  // ────────────────────────────────────────────
  private async servedCached(
    subKey: string,
    ttlSeconds: number,
    res: Response,
    fetcher: () => Promise<unknown>,
  ): Promise<unknown> {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('x-served-by', 'vence-backend');

    const key = await this.versioning.buildKey(TAG, subKey);

    const cached = await this.cache.getCached<unknown>(key);
    if (cached !== null) {
      res.setHeader('x-test-config-cache', 'hit');
      return cached;
    }

    res.setHeader('x-test-config-cache', 'miss');
    const result = await fetcher();
    // Solo cachear respuestas success — los errores no contaminan el cache
    if (result && typeof result === 'object' && (result as { success?: boolean }).success !== false) {
      this.cache.setCached(key, result, ttlSeconds);
    }
    return result;
  }
}
