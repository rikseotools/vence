/**
 * El ORDEN de los crons de contenido es un invariante, no una casualidad.
 *
 * `advance-estado` (06:30 UTC) corrige solo los estados que han vencido:
 * `inscripcion_abierta` con el plazo pasado → `inscripcion_cerrada`. Todo sensor que MIRE estados
 * tiene que correr después, o denunciará como avería lo que el sistema arregla solo unas horas más
 * tarde. El diseño ya lo decía —`detect-timeline-silence` (07:00) y `check-seguimiento` (09:00) están
 * puestos ahí a propósito— pero el barrido de salud se había quedado fuera de esa cadena, a las 03:00.
 *
 * Consecuencia medida el 28/07/2026: el badge amanecía con 4 `convocatoria_estado_incoherente` en rojo
 * que `advance-estado` cerraba a las 06:30. Cuatro falsos positivos cada día, que es exactamente como
 * se le enseña a alguien a ignorar un panel de alertas.
 *
 * Este test lee los cron expressions REALES de los ficheros: si alguien mueve una hora y rompe la
 * cadena, salta aquí y no dentro de tres semanas en forma de ruido diario.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

/** Minutos desde medianoche UTC de un `@Cron('m h * * *')` de un fichero. */
function horaDelCron(rutaRelativa: string, nombre: string): number {
  const src = readFileSync(join(__dirname, '..', '..', rutaRelativa), 'utf-8');
  const re = new RegExp(`@Cron\\('([0-9*/,]+) ([0-9*/,]+) [^']*'[^)]*name: '${nombre}'`);
  const m = re.exec(src);
  if (!m) throw new Error(`no encuentro el @Cron '${nombre}' en ${rutaRelativa}`);
  const [, min, hora] = m;
  if (min.includes('*') || hora.includes('*')) {
    throw new Error(`el cron '${nombre}' no tiene hora fija (${min} ${hora}): revisa este invariante`);
  }
  return Number(hora) * 60 + Number(min);
}

describe('orden de los crons que miran estados de convocatoria', () => {
  const advance = () => horaDelCron('src/advance-estado/advance-estado.cron.ts', 'advance-estado');
  const sweep = () => horaDelCron('src/content-health-sweep/content-health-sweep.cron.ts', 'content-health-sweep');

  it('el barrido de salud corre DESPUÉS de advance-estado', () => {
    expect(sweep()).toBeGreaterThan(advance());
  });

  it('con margen suficiente para que advance-estado haya terminado (≥30 min)', () => {
    expect(sweep() - advance()).toBeGreaterThanOrEqual(30);
  });

  it('las horas son las esperadas hoy (si cambian, que sea a propósito)', () => {
    expect(advance()).toBe(6 * 60 + 30);
    expect(sweep()).toBe(7 * 60 + 30);
  });
});
