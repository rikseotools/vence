/**
 * El reparto de los crons por minuto es un invariante de RENDIMIENTO, no una preferencia.
 *
 * Los `@Cron` corren en el MISMO contenedor que sirve las peticiones (T-254): cuando se apilan,
 * el opositor espera. Medido el 28/07: backend al 99,98% de CPU quince minutos y
 * `answer-and-save` a 16 s de media, con la base de datos al 8-20% y los créditos llenos.
 *
 * Este test lee los cron REALES de todos los ficheros de `backend/src`: si alguien añade otro
 * cron de paso 5 sobre el montón, salta aquí y no dentro de un mes en forma de timeouts.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { minutosQueDisparan, colisionesPorMinuto, peorMinuto } from './cron-colisiones';

describe('minutosQueDisparan', () => {
  it('entiende el paso: */5 dispara 12 veces, empezando en 0', () => {
    const m = minutosQueDisparan('*/5');
    expect(m).toHaveLength(12);
    expect(m[0]).toBe(0);
    expect(m[1]).toBe(5);
  });

  it('entiende el DESPLAZAMIENTO, que es la herramienta para repartirlos', () => {
    const m = minutosQueDisparan('2-57/5');
    expect(m[0]).toBe(2);
    expect(m).toHaveLength(12);            // misma cadencia…
    expect(m).not.toContain(0);            // …pero ya no en el minuto del montón
    expect(m).not.toContain(30);
  });

  it('un minuto fijo es un minuto fijo, y una lista son varios', () => {
    expect(minutosQueDisparan('7')).toEqual([7]);
    expect(minutosQueDisparan('0,30')).toEqual([0, 30]);
  });

  it('`*` dispara los 60 minutos', () => {
    expect(minutosQueDisparan('*')).toHaveLength(60);
  });

  it('no se rompe con basura (un cron ilegible no debe tumbar el guardarraíl)', () => {
    expect(minutosQueDisparan('')).toEqual([]);
    expect(minutosQueDisparan('*/0')).toEqual([]);
    expect(minutosQueDisparan('marciano')).toEqual([]);
  });
});

describe('colisionesPorMinuto / peorMinuto', () => {
  it('cuenta cuántos coinciden: */5 y */10 se apilan en el 0', () => {
    const c = colisionesPorMinuto(['*/5', '*/10', '*/15', '*/30']);
    expect(c[0]).toBe(4);
    expect(c[5]).toBe(1);
  });

  it('desplazarlos deshace el montón sin tocar la cadencia', () => {
    expect(peorMinuto(['*/5', '*/5', '*/5']).n).toBe(3);
    expect(peorMinuto(['*/5', '1-56/5', '2-57/5']).n).toBe(1);
  });
});

/** Todos los `@Cron('<minutos> …')` de backend/src, con su fichero. */
function cronsDelRepo(): { fichero: string; expr: string; campoMinutos: string }[] {
  const raiz = join(__dirname, '..');
  const out: { fichero: string; expr: string; campoMinutos: string }[] = [];
  const recorrer = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { recorrer(p); continue; }
      if (!p.endsWith('.cron.ts') || p.endsWith('.spec.ts')) continue;
      const src = readFileSync(p, 'utf-8');
      for (const m of src.matchAll(/@Cron\('([^']+)'/g)) {
        const campo = m[1].trim().split(/\s+/)[0];
        // Solo los sub-horarios compiten por el mismo minuto; los diarios llevan hora fija y
        // tienen su propio invariante de orden en content-health-sweep.cron.spec.ts.
        if (/[*/]/.test(campo)) out.push({ fichero: p.replace(raiz, ''), expr: m[1], campoMinutos: campo });
      }
    }
  };
  recorrer(raiz);
  return out;
}

describe('los crons REALES del backend no se apilan', () => {
  const TOPE = 6;

  it('encuentra los crons sub-horarios (si esto falla, el guardarraíl no está mirando nada)', () => {
    expect(cronsDelRepo().length).toBeGreaterThan(8);
  });

  it(`ningún minuto de la hora arranca más de ${TOPE} crons a la vez`, () => {
    const crons = cronsDelRepo();
    const { minuto, n } = peorMinuto(crons.map((c) => c.campoMinutos));
    const culpables = crons
      .filter((c) => minutosQueDisparan(c.campoMinutos).includes(minuto))
      .map((c) => `${c.fichero} (${c.expr})`);
    expect(
      n <= TOPE ? 'ok' : 'minuto ' + minuto + ': ' + n + ' crons a la vez -> ' + culpables.join(' | '),
    ).toBe('ok');
  });
});
