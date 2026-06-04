import {
  buildInstanceUrl,
  parsePoolRow,
  parseStatsRow,
} from './pooler-instance-sampler.service';

describe('buildInstanceUrl', () => {
  const base =
    'postgresql://postgres:s3cr3t@pooler.vence.es:6543/postgres?sslmode=require';

  it('reescribe host a la IP y mantiene puerto 6543 + dbname postgres', () => {
    const u = buildInstanceUrl(base, '172.26.6.134', 'postgres');
    expect(u).toContain('@172.26.6.134:6543/postgres');
    expect(u).toContain('sslmode=require');
    expect(u).toContain('postgres:s3cr3t@'); // credenciales preservadas
  });

  it('apunta a la admin db pgbouncer cuando se pide', () => {
    const u = buildInstanceUrl(base, '172.26.23.115', 'pgbouncer');
    expect(u).toContain('@172.26.23.115:6543/pgbouncer');
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
