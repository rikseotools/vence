import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ALERT_RULES,
  RULE_ANSWER_SAVE_PRESUPUESTO_AGOTADO,
} from './alert-rules';

/**
 * [T-315] — la señal que el backend estrena (`answer_save_presupuesto_agotado`) tiene que
 * tener quien la mire. Emitir un `error` que ninguna regla vigila es el hueco exacto que dejó
 * 17 pagos bloqueados invisibles (y el que el push-guard de robustez caza al escribirlo).
 *
 * Estos tests no comprueban «que la alerta funcione» (eso lo dice el motor corriendo), sino
 * las tres cosas que se pueden perder en silencio: que esté registrada, que su corte no la
 * encienda con el goteo normal, y que su aviso diga qué mirar.
 */
describe('RULE_ANSWER_SAVE_PRESUPUESTO_AGOTADO', () => {
  const reglaTexto = readFileSync(join(__dirname, 'alert-rules.ts'), 'utf8')
    .split('export const RULE_ANSWER_SAVE_PRESUPUESTO_AGOTADO')[1]
    .split('export const')[0];

  it('está REGISTRADA en el motor (si no, no la ejecuta nadie)', () => {
    expect(ALERT_RULES.map((r) => r.name)).toContain(
      'answer_save_presupuesto_agotado',
    );
  });

  it('vigila la señal que emite el controller, no otra parecida', () => {
    expect(reglaTexto).toContain("event_type = 'answer_save_presupuesto_agotado'");
  });

  it('exige ≥2 usuarios: con uno solo puede ser su conexión, no la nuestra', () => {
    expect(reglaTexto).toContain('COUNT(DISTINCT user_id) >= 2');
    expect(reglaTexto).toContain('COUNT(*) >= 5');
  });

  it('no dispara sin filas', () => {
    expect(RULE_ANSWER_SAVE_PRESUPUESTO_AGOTADO.shouldFire([])).toBe(false);
  });

  it('dispara con filas y cuenta el daño en respuestas, no en peticiones', () => {
    const filas = [
      { fase: 'guardar', n: 9, usuarios: 4, peorMs: 20_004 },
      { fase: 'comprobaciones', n: 5, usuarios: 2, peorMs: 5_002 },
    ];
    expect(RULE_ANSWER_SAVE_PRESUPUESTO_AGOTADO.shouldFire(filas)).toBe(true);

    const aviso = RULE_ANSWER_SAVE_PRESUPUESTO_AGOTADO.buildNotification(filas);
    expect(aviso.title).toContain('14 respuesta(s) de test sin guardar');
    expect(aviso.title).toContain('4 usuarios');
  });

  it('cuando la fase es GUARDAR, el aviso dice que la respuesta NO se guardó', () => {
    const aviso = RULE_ANSWER_SAVE_PRESUPUESTO_AGOTADO.buildNotification([
      { fase: 'guardar', n: 6, usuarios: 3, peorMs: 20_010 },
    ]);
    expect(aviso.body).toContain('NO llegó a');
    expect(aviso.body).toContain('test_questions');
  });

  it('cuando la fase es COMPROBAR, NO acusa al guardado (mandaría a mirar donde no es)', () => {
    const aviso = RULE_ANSWER_SAVE_PRESUPUESTO_AGOTADO.buildNotification([
      { fase: 'comprobaciones', n: 6, usuarios: 3, peorMs: 5_001 },
    ]);
    expect(aviso.body).toContain('antifraude');
    expect(aviso.body).not.toContain('NO llegó a');
  });

  it('el aviso manda mirar la CPU del backend ANTES que la BD', () => {
    const aviso = RULE_ANSWER_SAVE_PRESUPUESTO_AGOTADO.buildNotification([
      { fase: 'guardar', n: 6, usuarios: 3, peorMs: 20_010 },
    ]);
    expect(aviso.body.indexOf('CPU del contenedor BACKEND')).toBeLessThan(
      aviso.body.indexOf('Solo DESPUÉS la BD'),
    );
  });

  it('tiene cooldown: un rato malo no manda doce correos', () => {
    expect(RULE_ANSWER_SAVE_PRESUPUESTO_AGOTADO.cooldownMin).toBeGreaterThanOrEqual(30);
  });
});
