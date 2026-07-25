import { ConfigService } from '@nestjs/config';
import { SimCanaryService } from './sim-canary.service';
import {
  questionsWithinSelection,
  nonEmptyAndFast,
  allOk,
  type Selection,
} from './sim-invariants';

const SEL: Selection = {
  laws: ['Ley 39/2015', 'Ley 40/2015'],
  articlesByLaw: { 'Ley 40/2015': ['32', '33', '34', '35', '36'] },
};

describe('sim-invariants (puras)', () => {
  it('questionsWithinSelection OK', () => {
    expect(questionsWithinSelection([{ law: 'Ley 40/2015', article: '33' }, { law: 'Ley 39/2015', article: '13' }], SEL).ok).toBe(true);
  });
  it('questionsWithinSelection FALLA fuera de 32-36', () => {
    const r = questionsWithinSelection([{ law: 'Ley 40/2015', article: '99' }], SEL);
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/99/);
  });
  it('questionsWithinSelection FALLA ley no seleccionada', () => {
    expect(questionsWithinSelection([{ law: 'CE', article: '1' }], SEL).ok).toBe(false);
  });
  it('nonEmptyAndFast', () => {
    expect(nonEmptyAndFast(10, 500, { minCount: 1, maxMs: 9000 }).ok).toBe(true);
    expect(nonEmptyAndFast(0, 500, { minCount: 1, maxMs: 9000 }).ok).toBe(false);
    expect(nonEmptyAndFast(10, 99999, { minCount: 1, maxMs: 9000 }).ok).toBe(false);
  });
  it('allOk deriva veredicto', () => {
    expect(allOk([{ name: 'a', ok: true }]).passed).toBe(true);
    expect(allOk([{ name: 'a', ok: false, detail: 'x' }]).firstFailure).toMatch(/a: x/);
  });
});

describe('SimCanaryService (fetch mockeado)', () => {
  const config = { get: () => 'https://www.vence.es' } as unknown as ConfigService;
  const service = new SimCanaryService(config);
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('journeyQuestionsWithinSelection PASA cuando todo está en la selección', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ questions: [
        { article: { article_number: '33', law: { short_name: 'Ley 40/2015' } } },
        { article: { article_number: '13', law: { short_name: 'Ley 39/2015' } } },
      ] }),
    }) as any;
    const r = await service.journeyQuestionsWithinSelection();
    expect(r.passed).toBe(true);
    expect(r.journey).toBe('api-questions-within-selection');
  });

  it('journeyQuestionsWithinSelection FALLA si el motor cuela una fuera de 32-36', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ questions: [
        { article: { article_number: '50', law: { short_name: 'Ley 40/2015' } } },
      ] }),
    }) as any;
    const r = await service.journeyQuestionsWithinSelection();
    expect(r.passed).toBe(false);
    expect(r.firstFailure).toMatch(/questions_within_selection/);
  });

  it('journeyLawsConfigurator FALLA si viene vacío', async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ data: [] }) }) as any;
    const r = await service.journeyLawsConfigurator();
    expect(r.passed).toBe(false);
  });

  it('journeyQuestionsWithinSelection SALTA (no falla) ante el reto anti-scraping', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 403,
      json: async () => ({ challengeRequired: true, provider: 'turnstile', action: 'load_questions' }),
    }) as any;
    const r = await service.journeyQuestionsWithinSelection();
    expect(r.skipped).toBe(true);
    expect(r.passed).toBe(true); // skip NO cuenta como fallo
    expect(r.skipReason).toMatch(/anti-scraping/);
  });

  it('journey captura errores de red sin lanzar', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;
    const r = await service.journeyQuestionsWithinSelection();
    expect(r.passed).toBe(false);
    expect(r.error).toMatch(/ECONNREFUSED/);
  });
});
