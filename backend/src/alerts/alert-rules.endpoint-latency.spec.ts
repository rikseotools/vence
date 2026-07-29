import { readFileSync } from 'fs';
import { join } from 'path';
import { RULE_ENDPOINT_LATENCY_SUSTAINED, ALERT_RULES } from './alert-rules';

/**
 * Guardarraíl de PARIDAD entre la regla de alerta (SQL, backend) y el núcleo del panel
 * (TypeScript, frontend) — T-254.
 *
 * ## Por qué hay dos copias y por qué no se pueden fusionar
 *
 * La imagen Docker del backend solo copia `backend/src` (ver `backend/Dockerfile`), así que la
 * regla NO puede importar `lib/api/admin/endpoint-latency.ts`. La duplicación es una consecuencia
 * del límite de build, no una decisión de estilo — y como no se puede eliminar, se VIGILA.
 *
 * ## Por qué esto importa aquí más que en otros sitios
 *
 * Ya pasó en T-107: el núcleo JS tenía una variante que RDS no, y el canary no lo vio porque
 * miraba una lista de fixtures que se había quedado atrás. Una divergencia entre el panel y la
 * alerta es peor que no tener alerta: el panel diría rojo y el correo no llegaría, o al revés, y
 * nadie sabría cuál de los dos miente.
 *
 * Se lee el fichero del frontend como TEXTO a propósito: importarlo ataría el build del backend
 * justo a lo que este test existe para vigilar.
 */
describe('RULE_ENDPOINT_LATENCY_SUSTAINED — paridad con el núcleo del panel', () => {
  const raiz = join(__dirname, '..', '..', '..');
  const leer = (rel: string) => readFileSync(join(raiz, rel), 'utf8');

  const nucleo = leer('lib/api/admin/endpoint-latency.ts');
  const clasificacion = leer('lib/api/admin/endpoint-classification.ts');
  const sqlTexto = String((RULE_ENDPOINT_LATENCY_SUSTAINED.query as { queryChunks?: unknown }) ?? '')
    // `sql` de drizzle no expone el texto plano; se reconstruye del fichero, que es lo que se audita.
    || '';
  const reglaTexto = leer('backend/src/alerts/alert-rules.ts')
    .split('export const RULE_ENDPOINT_LATENCY_SUSTAINED')[1]
    .split('export const ')[0];

  const numeroDe = (texto: string, patron: RegExp): number => {
    const m = texto.match(patron);
    expect(m).not.toBeNull();
    return Number(String(m![1]).replace(/_/g, ''));
  };

  it('el umbral ROJO user_facing es el mismo en los dos sitios', () => {
    const enTs = numeroDe(nucleo, /user_facing:\s*\{\s*amber:\s*[\d_]+,\s*red:\s*([\d_]+)/);
    expect(enTs).toBe(5000);
    expect(reglaTexto).toContain(`p95 >= ${enTs} THEN 'red'`);
  });

  it('el umbral ÁMBAR user_facing es el mismo en los dos sitios', () => {
    const enTs = numeroDe(nucleo, /user_facing:\s*\{\s*amber:\s*([\d_]+)/);
    expect(enTs).toBe(2000);
    expect(reglaTexto).toContain(`p95 >= ${enTs} THEN 'amber'`);
  });

  it('el tamaño del cubo es el mismo (5 min = 300 s en el SQL)', () => {
    const minutos = numeroDe(nucleo, /LATENCY_BUCKET_MINUTES\s*=\s*(\d+)/);
    expect(minutos).toBe(5);
    expect(reglaTexto).toContain(`/ ${minutos * 60}) * ${minutos * 60}`);
    expect(reglaTexto).toContain(`INTERVAL '${minutos} minutes'`);
  });

  it('el mínimo de muestras por cubo es el mismo', () => {
    const min = numeroDe(nucleo, /LATENCY_MIN_SAMPLES\s*=\s*(\d+)/);
    expect(min).toBe(10);
    expect(reglaTexto).toContain(`HAVING COUNT(*) >= ${min}`);
  });

  it('la lista de endpoints ADMIN excluidos cubre todos los patrones del frontend', () => {
    // Si alguien añade un patrón admin en el frontend y no aquí, la alerta empezaría a despertar
    // a alguien por una herramienta interna lenta. Este test lo caza en CI.
    const patrones = [...clasificacion.matchAll(/\/\^\\\/api\\\/([a-z0-9|\\/-]+)\(/g)]
      .map((m) => m[1].replace(/\\/g, ''));
    expect(patrones.length).toBeGreaterThanOrEqual(7);
    for (const p of patrones) {
      expect(reglaTexto).toContain(p);
    }
  });

  it('la racha exige ≥2 cubos y al menos uno rojo (la firma que caza el caso de origen)', () => {
    expect(reglaTexto).toContain("HAVING COUNT(*) >= 2 AND BOOL_OR(estado = 'red')");
  });

  it('la ventana de la consulta cubre varias rachas seguidas del motor (corre cada 5 min)', () => {
    // Con 45 min de ventana, una racha entra entera aunque el motor la pille a mitad.
    expect(reglaTexto).toContain("INTERVAL '45 minutes'");
  });

  it('la regla está REGISTRADA en el motor (si no, no la ejecuta nadie)', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain('endpoint_latency_sustained');
  });

  it('tiene cooldown: una degradación de una hora no manda doce correos', () => {
    expect(RULE_ENDPOINT_LATENCY_SUSTAINED.cooldownMin).toBeGreaterThanOrEqual(30);
  });

  it('el cuerpo del aviso manda mirar la CPU del backend ANTES que la BD (causa confirmada)', () => {
    const aviso = RULE_ENDPOINT_LATENCY_SUSTAINED.buildNotification([
      { endpoint: '/api/v2/answer-and-save', desde: '2026-07-28 09:30:00', buckets: 3, peorP95Ms: 25145 },
    ]);
    expect(aviso.title).toContain('1 endpoint');
    expect(aviso.body).toContain('CPU del contenedor BACKEND');
    expect(aviso.body).toContain('answer-and-save');
    // El orden importa: en el incidente real la BD estaba bien y perseguirla habría costado el turno.
    expect(aviso.body.indexOf('CPU del contenedor BACKEND')).toBeLessThan(
      aviso.body.indexOf('Solo DESPUÉS, la BD'),
    );
  });

  it('no dispara sin filas', () => {
    expect(RULE_ENDPOINT_LATENCY_SUSTAINED.shouldFire([])).toBe(false);
    expect(sqlTexto).toBeDefined();
  });
});
