import { canaryOutcomeEvent, cronRunEvent, canaryEndpoint } from './canary-emit';
import { CanaryResult } from './canary-result';

// El probe database-pool: eventBase='db_pool' ≠ name='database-pool'. Estos tests
// CONGELAN los strings exactos que emitía el cron a mano, para que migrarlo al
// runner no cambie la observabilidad ni rompa RULE_CANARY_DB_POOL_FAILED.
const dbPool = { name: 'database-pool', eventBase: 'db_pool' };

describe('canary-emit — evento de resultado (preserva strings exactos)', () => {
  it('OK → canary_db_pool_ok / info / metadata {cron} SIN step ni errorMessage', () => {
    const r: CanaryResult = { status: 'ok', durationMs: 42 };
    expect(canaryOutcomeEvent(dbPool, r)).toEqual({
      source: 'fargate',
      severity: 'info',
      eventType: 'canary_db_pool_ok',
      endpoint: 'canary-database-pool',
      durationMs: 42,
      metadata: { cron: 'canary-database-pool' },
    });
  });

  it('FAILED → canary_db_pool_failed / critical / metadata {cron, step} + errorMessage', () => {
    const r: CanaryResult = { status: 'failed', step: 'timeout', errorMessage: 'Query timeout >1000ms', durationMs: 1001 };
    expect(canaryOutcomeEvent(dbPool, r)).toEqual({
      source: 'fargate',
      severity: 'critical',
      eventType: 'canary_db_pool_failed',
      endpoint: 'canary-database-pool',
      durationMs: 1001,
      errorMessage: 'Query timeout >1000ms',
      metadata: { cron: 'canary-database-pool', step: 'timeout' },
    });
  });

  it('SKIPPED → warn / metadata lleva reason (no step)', () => {
    const r: CanaryResult = { status: 'skipped', reason: 'credentials_not_configured', durationMs: 1 };
    const e = canaryOutcomeEvent({ name: 'answer-save', eventBase: 'answer_save' }, r);
    expect(e.eventType).toBe('canary_answer_save_skipped');
    expect(e.severity).toBe('warn');
    expect(e.metadata).toEqual({ cron: 'canary-answer-save', reason: 'credentials_not_configured' });
  });
});

describe('canary-emit — cron_run (liveness)', () => {
  it('completed → info / status completed', () => {
    expect(cronRunEvent('database-pool', 50, 'completed')).toEqual({
      source: 'fargate',
      severity: 'info',
      eventType: 'cron_run',
      endpoint: 'canary-database-pool',
      durationMs: 50,
      metadata: { cron: 'canary-database-pool', status: 'completed' },
    });
  });

  it('failure → error / status failure + errorMessage', () => {
    const e = cronRunEvent('database-pool', 50, 'failure', 'boom');
    expect(e.severity).toBe('error');
    expect(e.errorMessage).toBe('boom');
    expect(e.metadata).toEqual({ cron: 'canary-database-pool', status: 'failure' });
  });

  it('canaryEndpoint deriva canary-<name>', () => {
    expect(canaryEndpoint('database-pool')).toBe('canary-database-pool');
  });
});

// Congela los strings de los canaries migrados en esta tanda (redis, synthetic-external).
describe('canary-emit — canaries migrados (P2 tanda read-only)', () => {
  const redis = { name: 'redis-upstash', eventBase: 'redis' }; // eventBase ≠ name

  it('redis OK preserva canary_redis_ok + metadata {cron, provider}', () => {
    const e = canaryOutcomeEvent(redis, { status: 'ok', durationMs: 5, metadata: { provider: 'upstash' } });
    expect(e.eventType).toBe('canary_redis_ok');
    expect(e.endpoint).toBe('canary-redis-upstash');
    expect(e.metadata).toEqual({ cron: 'canary-redis-upstash', provider: 'upstash' });
  });

  it('redis FAILED preserva canary_redis_failed + metadata {cron, step, provider}', () => {
    const e = canaryOutcomeEvent(redis, { status: 'failed', step: 'get', errorMessage: 'x', durationMs: 9, metadata: { provider: 'elasticache' } });
    expect(e.eventType).toBe('canary_redis_failed');
    expect(e.severity).toBe('critical');
    expect(e.metadata).toEqual({ cron: 'canary-redis-upstash', step: 'get', provider: 'elasticache' });
  });

  it('synthetic-external OK esparce details en metadata: {cron, ...details}', () => {
    const e = canaryOutcomeEvent(
      { name: 'synthetic-external', eventBase: 'synthetic_external' },
      { status: 'ok', durationMs: 12, metadata: { homeMs: 80, chunkOk: true } },
    );
    expect(e.eventType).toBe('canary_synthetic_external_ok');
    expect(e.metadata).toEqual({ cron: 'canary-synthetic-external', homeMs: 80, chunkOk: true });
  });

  it('httpStatus del CanaryResult se emite al evento (para stripe/topic al migrarlos)', () => {
    const e = canaryOutcomeEvent(redis, { status: 'failed', step: 'x', errorMessage: 'y', httpStatus: 503, durationMs: 1 });
    expect(e.httpStatus).toBe(503);
  });
});
