import { CanaryCompetitorMentionService } from './canary-competitor-mention.service';

// Mock del db: solo necesitamos db.execute() → filas.
function makeService(rows: unknown) {
  const db = { execute: jest.fn().mockResolvedValue(rows) };
  return new CanaryCompetitorMentionService(db as never);
}

describe('CanaryCompetitorMentionService', () => {
  it('0 menciones activas → ok (contenido limpio)', async () => {
    const r = await makeService([{ active_hits: 0, sample_ids: [] }]).run();
    expect(r.ok).toBe(true);
    expect('activeHits' in r && r.activeHits).toBe(0);
  });

  it('>0 menciones activas → NO ok (dispara la alerta) + expone sample ids', async () => {
    const r = await makeService([{ active_hits: 3, sample_ids: ['a', 'b', 'c'] }]).run();
    expect(r.ok).toBe(false);
    expect('activeHits' in r && r.activeHits).toBe(3);
    expect('sampleIds' in r && r.sampleIds).toEqual(['a', 'b', 'c']);
  });

  it('filas vacías → activeHits 0 → ok (defensivo)', async () => {
    const r = await makeService([]).run();
    expect(r.ok).toBe(true);
  });

  it('error de BD → ok:false con mensaje (nunca revienta el cron)', async () => {
    const db = { execute: jest.fn().mockRejectedValue(new Error('db down')) };
    const r = await new CanaryCompetitorMentionService(db as never).run();
    expect(r.ok).toBe(false);
    expect('error' in r && r.error).toContain('db down');
  });
});
