import * as fs from 'fs';
import * as path from 'path';

/**
 * Guardarraíl: TODO cron `@Cron` que use `runWithHeartbeat` DEBE pasar el opts
 * `{ name, observability }` para emitir la señal de arranque `cron_tick`. Sin
 * esto, la regla `cron_overdue` solo vería el `cron_run` de completado y un
 * cron lento (escaneo LLM) volvería a falsear overdue. Ver heartbeat.helpers.
 *
 * Allowlist: crons `@Interval` (no los vigila `cron_overdue`, son de alta
 * frecuencia y emitir un tick por iteración saturaría observable_events).
 */
const INTERVAL_ALLOWLIST = new Set(['outbox-processor.cron.ts']);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (
      entry.name.endsWith('.cron.ts') &&
      !entry.name.endsWith('.spec.ts')
    )
      out.push(full);
  }
  return out;
}

describe('cobertura de cron_tick (guardarraíl)', () => {
  const srcRoot = path.join(__dirname, '..');
  const cronFiles = walk(srcRoot);

  it('hay archivos .cron.ts que escanear (sanity)', () => {
    expect(cronFiles.length).toBeGreaterThan(20);
  });

  it.each(cronFiles.map((f) => [path.basename(f), f]))(
    '%s: todo @Cron con runWithHeartbeat pasa el opts de cron_tick',
    (basename, full) => {
      const content = fs.readFileSync(full, 'utf-8');
      const usesWrapper = /runWithHeartbeat\(\s*this\b/.test(content);
      const isCron = /@Cron\(/.test(content);
      if (!usesWrapper || !isCron) return; // no aplica

      if (INTERVAL_ALLOWLIST.has(basename as string)) {
        // Debe ser @Interval y NO pasar opts (exclusión deliberada).
        expect(/@Interval\(/.test(content)).toBe(true);
        return;
      }

      // El opts de arranque se reconoce por `observability: this.observability`
      // (solo aparece en el 4º arg; los emit usan `this.observability.emit(...)`).
      expect(content).toMatch(/observability:\s*this\.observability/);
      expect(content).toMatch(/name:\s*'[a-z0-9-]+'/);
    },
  );
});
