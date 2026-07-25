// backend/src/sim-canary/sim-canary.service.ts
//
// Vence Sim — canary Fargate (server-side, SIN navegador NI secreto). Corre los journeys
// de NIVEL API contra el app vivo y afirma invariantes de dominio. Los journeys de UI
// (Playwright) viven en scripts/sim (on-demand); aquí solo lo que un cron puede validar
// por HTTP. Nace del feedback de Alfonso (25/07): "salen preguntas fuera de lo
// seleccionado" → invariante questionsWithinSelection en cada corrida.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  questionsWithinSelection,
  nonEmptyAndFast,
  allOk,
  type InvariantResult,
  type ServedQuestion,
  type Selection,
} from './sim-invariants';

export interface SimJourneyResult {
  journey: string;
  passed: boolean;
  durationMs: number;
  firstFailure?: string;
  invariants: InvariantResult[];
  error?: string;
  /** El journey no se validó por una razón esperada (p.ej. el gate anti-scraping pidió
   *  reto Turnstile a este fetch server-to-server). NO cuenta como fallo. La validación
   *  completa de este invariante la hace el sim on-demand por navegador (resuelve el reto). */
  skipped?: boolean;
  skipReason?: string;
}

/** Journeys semilla (configurables). El seed reproduce el caso de Alfonso. */
const SEED = {
  positionType: 'celador_murcia',
  selection: {
    laws: ['Ley 39/2015', 'Ley 40/2015'],
    articlesByLaw: { 'Ley 40/2015': ['32', '33', '34', '35', '36'] },
  } as Selection,
};

@Injectable()
export class SimCanaryService {
  private readonly logger = new Logger(SimCanaryService.name);

  constructor(private readonly config: ConfigService) {}

  private baseUrl(): string {
    return this.config.get<string>('APP_BASE_URL') ?? 'https://www.vence.es';
  }

  /** Extrae (ley, artículo) de una pregunta del endpoint filtered, tolerante a la forma. */
  private static toServed(q: any): ServedQuestion {
    const a = q?.article ?? {};
    const article = String(a.article_number ?? q?.article_number ?? '?');
    const law = String((a.law && a.law.short_name) || q?.law_short_name || q?.law_name || '?');
    return { law, article };
  }

  /** Journey 1: la página de leyes acotada a la oposición carga (no vacía y rápida). */
  async journeyLawsConfigurator(): Promise<SimJourneyResult> {
    const journey = 'api-laws-configurator-scoped';
    const t0 = Date.now();
    try {
      const url = `${this.baseUrl()}/api/laws-configurator?positionType=${encodeURIComponent(SEED.positionType)}`;
      const res = await fetch(url);
      const durationMs = Date.now() - t0;
      const body: any = await res.json().catch(() => ({}));
      const laws = Array.isArray(body?.data) ? body.data.length : 0;
      const invariants = [nonEmptyAndFast(laws, durationMs, { minCount: 5, maxMs: 9000 })];
      const { passed, firstFailure } = allOk(invariants);
      return { journey, passed, durationMs, firstFailure, invariants };
    } catch (e: any) {
      return { journey, passed: false, durationMs: Date.now() - t0, invariants: [], error: e?.message?.slice(0, 200) };
    }
  }

  /** Journey 2 (núcleo): ninguna pregunta fuera de la selección (bug Alfonso #2). */
  async journeyQuestionsWithinSelection(): Promise<SimJourneyResult> {
    const journey = 'api-questions-within-selection';
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.baseUrl()}/api/questions/filtered`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicNumber: 0,
          positionType: SEED.positionType,
          numQuestions: 100,
          selectedLaws: SEED.selection.laws,
          selectedArticlesByLaw: { 'Ley 40/2015': [32, 33, 34, 35, 36] },
          scopeToPosition: true,
          difficultyMode: 'random',
        }),
      });
      const durationMs = Date.now() - t0;
      const body: any = await res.json().catch(() => ({}));
      // El gate anti-scraping (Turnstile) challengea los POST server-to-server (es su
      // función). No es un fallo del canary → SKIP. La invariante "nada fuera de la
      // selección" se valida por navegador en el sim on-demand (scripts/sim), que resuelve
      // el reto como un usuario real.
      if (res.status === 403 && body?.challengeRequired) {
        return { journey, passed: true, skipped: true, skipReason: 'anti-scraping challenge (validado on-demand por navegador)', durationMs, invariants: [] };
      }
      const questions: ServedQuestion[] = Array.isArray(body?.questions)
        ? body.questions.map((q: any) => SimCanaryService.toServed(q))
        : [];
      const invariants = [
        nonEmptyAndFast(questions.length, durationMs, { minCount: 1, maxMs: 9000 }),
        questionsWithinSelection(questions, SEED.selection),
      ];
      const { passed, firstFailure } = allOk(invariants);
      return { journey, passed, durationMs, firstFailure, invariants };
    } catch (e: any) {
      return { journey, passed: false, durationMs: Date.now() - t0, invariants: [], error: e?.message?.slice(0, 200) };
    }
  }

  /** Corre todos los journeys de API. */
  async run(): Promise<SimJourneyResult[]> {
    const results = [
      await this.journeyLawsConfigurator(),
      await this.journeyQuestionsWithinSelection(),
    ];
    for (const r of results) {
      const icon = r.skipped ? '⏭️' : r.passed ? '✅' : '❌';
      const tail = r.skipped ? ` — SKIP: ${r.skipReason}` : r.passed ? '' : ` — ${r.firstFailure ?? r.error}`;
      this.logger.log(`${icon} ${r.journey}${tail} (${r.durationMs}ms)`);
    }
    return results;
  }
}
