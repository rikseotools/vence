import {
  buildInstanceConfig,
  parsePoolRow,
  parseStatsRow,
} from './pooler-instance-sampler.service';

describe('buildInstanceConfig', () => {
  const base =
    'postgresql://postgres:s3cr3t@pooler.vence.es:6543/postgres?sslmode=require';

  it('fija host a la IP, puerto 6543, dbname y servername TLS del cert', () => {
    const cfg: any = buildInstanceConfig(base, '172.26.6.134', 'postgres');
    expect(cfg.host).toBe('172.26.6.134');
    expect(cfg.port).toBe(6543);
    expect(cfg.database).toBe('postgres');
    expect(cfg.user).toBe('postgres');
    expect(cfg.password).toBe('s3cr3t');
    expect(cfg.ssl).toMatchObject({
      rejectUnauthorized: false,
      servername: 'pooler.vence.es',
    });
  });

  it('apunta a la admin db pgbouncer cuando se pide', () => {
    const cfg: any = buildInstanceConfig(base, '172.26.23.115', 'pgbouncer');
    expect(cfg.host).toBe('172.26.23.115');
    expect(cfg.database).toBe('pgbouncer');
  });

  it('robusto ante password con caracteres especiales (donde new URL fallaba)', () => {
    const tricky =
      'postgresql://postgres:p%40ss%2Fw0rd%3A@pooler.vence.es:6543/postgres';
    const cfg: any = buildInstanceConfig(tricky, '172.26.6.134', 'postgres');
    expect(cfg.host).toBe('172.26.6.134');
    expect(cfg.user).toBe('postgres');
    expect(typeof cfg.password).toBe('string');
    expect(cfg.password.length).toBeGreaterThan(0);
  });
});

describe('parsePoolRow', () => {
  it('elige la fila postgres/postgres y castea a número', () => {
    const rows = [
      { database: 'pgbouncer', user: 'pgbouncer', cl_active: '1', cl_waiting: '0' },
      {
        database: 'postgres',
        user: 'postgres',
        cl_active: '8',
        cl_waiting: '3',
        sv_active: '12',
        sv_idle: '4',
        maxwait_us: '15000',
      },
    ];
    expect(parsePoolRow(rows)).toEqual({
      clActive: 8,
      clWaiting: 3,
      svActive: 12,
      svIdle: 4,
      maxwaitUs: 15000,
    });
  });

  it('devuelve nulls si no hay fila postgres', () => {
    expect(parsePoolRow([{ database: 'other' }])).toEqual({
      clActive: null,
      clWaiting: null,
      svActive: null,
      svIdle: null,
      maxwaitUs: null,
    });
  });
});

describe('parseStatsRow', () => {
  it('deriva medias dividiendo por query_count', () => {
    const rows = [
      {
        database: 'postgres',
        query_count: '100',
        query_time: '500000', // us totales
        wait_time: '20000',
      },
    ];
    expect(parseStatsRow(rows)).toEqual({
      queryCount: 100,
      avgQueryTimeUs: 5000, // 500000/100
      avgWaitTimeUs: 200, // 20000/100
    });
  });

  it('evita división por cero', () => {
    const rows = [{ database: 'postgres', query_count: '0', query_time: '0' }];
    expect(parseStatsRow(rows)).toEqual({
      queryCount: 0,
      avgQueryTimeUs: null,
      avgWaitTimeUs: null,
    });
  });
});
