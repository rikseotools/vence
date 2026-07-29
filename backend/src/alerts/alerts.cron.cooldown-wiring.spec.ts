import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guardarraíl de CABLEADO del cooldown persistido (T-258).
 *
 * El núcleo puro (`alert-cooldown.ts`) tiene sus propios tests, pero unos tests
 * verdes sobre un núcleo que nadie llama son un falso verde — es literalmente
 * el fallo que el repo ya se comió con el canario de purga ISR (su primera
 * versión pasaba con la llamada al daemon comentada) y con la función
 * `rotuloEnlaceOficial`, que vivió sin usar mientras la página componía el
 * rótulo a mano.
 *
 * Aquí se fija lo que no puede volver atrás sin que el CI lo diga:
 *   1. El cron consulta el estado persistido.
 *   2. La decisión de cooldown pasa por el núcleo puro.
 *   3. NO reaparece la comparación a mano contra el Map en memoria.
 */
describe('AlertsCron ↔ cooldown persistido: cableado (T-258)', () => {
  const fuente = readFileSync(
    join(__dirname, 'alerts.cron.ts'),
    'utf8',
  );

  it('importa el núcleo puro en vez de reimplementar la decisión', () => {
    expect(fuente).toMatch(/from '\.\/alert-cooldown'/);
  });

  it('ejecuta la consulta del último disparo', () => {
    expect(fuente).toContain('LAST_FIRED_QUERY');
  });

  it('decide el cooldown con isInCooldown()', () => {
    expect(fuente).toMatch(/isInCooldown\(/);
  });

  it('combina memoria y BD con mergeLastFired()', () => {
    expect(fuente).toMatch(/mergeLastFired\(/);
  });

  it('NO vuelve a comparar a mano contra el Map en memoria', () => {
    // El patrón viejo era:
    //   const last = this.lastFiredAt.get(rule.name)
    //   if ((Date.now() - last) / 60_000 < rule.cooldownMin) continue
    // Si reaparece, el cooldown vuelve a morir en cada reinicio.
    expect(fuente).not.toMatch(/elapsedMin\s*<\s*rule\.cooldownMin/);
  });

  it('la hidratación es fail-open: su fallo no puede tumbar el tick', () => {
    // Un motor de alertas que se cae porque no pudo leer su propio historial
    // sería peor que el spam que estamos arreglando.
    const bloque = fuente.slice(
      fuente.indexOf('LAST_FIRED_QUERY'),
      fuente.indexOf('for (const rule of ALERT_RULES)'),
    );
    expect(bloque).toMatch(/catch/);
    expect(bloque).toMatch(/fail-open/i);
  });

  it('el silencio queda medido en el cron_run', () => {
    // "no dispara" y "está callado a propósito" tienen que ser distinguibles
    // desde fuera (lección T-162: quién vigila al vigilante).
    expect(fuente).toContain('rulesSkippedByPersistedCooldown');
    expect(fuente).toContain('cooldownHydrated');
  });
});
