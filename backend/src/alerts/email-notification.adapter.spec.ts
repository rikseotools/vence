import { EmailNotificationAdapter } from './email-notification.adapter';
import type { AlertNotification } from './notification-adapter';

/**
 * Transporte de email: formato de UNO y de LOTE (T-272).
 *
 * Lo que se protege aquí no es la estética del correo: es que agrupar no pierda
 * contenido ni rompa el envío.
 *   · El cuerpo de cada aviso llega ÍNTEGRO. En este repo los cuerpos llevan las
 *     consultas de diagnóstico y el "qué mirar, en orden" — recortarlos para que
 *     el digest quede corto destruiría justo lo que sirve a las 3 de la mañana.
 *   · Los tags de Resend no admiten comas. Un lote une nombres de regla con
 *     comas, así que sin saneo Resend RECHAZA el correo entero: el aviso se
 *     perdería por un detalle de formato, el peor cambio posible en este canal.
 */

interface Enviado {
  subject: string;
  html: string;
  tags: Array<{ name: string; value: string }>;
}

function adaptador(): {
  adapter: EmailNotificationAdapter;
  enviados: Enviado[];
} {
  const enviados: Enviado[] = [];
  const config = {
    get: (k: string) =>
      ({
        RESEND_API_KEY: 'fake',
        ADMIN_ALERTS_EMAIL: 'admin@example.com',
      })[k],
  };
  const adapter = new EmailNotificationAdapter(config as never);
  // Se sustituye el cliente de Resend, no la clase: así se ejercita el formato
  // real (asunto, html, tags) sin red.
  (adapter as unknown as { resend: unknown }).resend = {
    emails: {
      send: async (payload: Enviado) => {
        enviados.push(payload);
        return { data: { id: 'fake-id' }, error: null };
      },
    },
  };
  return { adapter, enviados };
}

const aviso = (over: Partial<AlertNotification> = {}): AlertNotification => ({
  rule: 'r_critica',
  severity: 'critical',
  title: 'Título crítico',
  body: 'CUERPO CON LA CONSULTA: SELECT 1;',
  ...over,
});

describe('EmailNotificationAdapter (T-272)', () => {
  it('con lista vacía no manda nada', async () => {
    const { adapter, enviados } = adaptador();
    await adapter.send([]);
    expect(enviados).toHaveLength(0);
  });

  it('un solo aviso conserva el asunto de siempre', async () => {
    const { adapter, enviados } = adaptador();
    await adapter.send([aviso()]);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toBe('[Vence CRITICAL] Título crítico');
    expect(enviados[0].html).toContain('CUERPO CON LA CONSULTA');
  });

  it('varios avisos = UN correo, con el conteo y el más grave en el asunto', async () => {
    const { adapter, enviados } = adaptador();
    await adapter.send([
      aviso({ rule: 'r_error', severity: 'error', title: 'Menos grave' }),
      aviso({ title: 'El grave' }),
    ]);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].subject).toBe('[Vence CRITICAL] 2 avisos — El grave');
  });

  it('el digest conserva ÍNTEGRO el cuerpo de cada aviso', async () => {
    const { adapter, enviados } = adaptador();
    await adapter.send([
      aviso({ rule: 'r_uno', body: 'DIAGNOSTICO UNO: SELECT a;' }),
      aviso({ rule: 'r_dos', body: 'DIAGNOSTICO DOS: SELECT b;' }),
    ]);
    const html = enviados[0].html;
    expect(html).toContain('DIAGNOSTICO UNO');
    expect(html).toContain('DIAGNOSTICO DOS');
    expect(html).toContain('r_uno');
    expect(html).toContain('r_dos');
  });

  it('el tag de regla se sanea: una coma haría que Resend rechace el correo', async () => {
    const { adapter, enviados } = adaptador();
    await adapter.send([aviso({ rule: 'r_uno' }), aviso({ rule: 'r_dos' })]);
    const tag = enviados[0].tags.find((t) => t.name === 'rule')?.value ?? '';
    expect(tag).not.toContain(',');
    expect(tag).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(tag).toContain('r_uno');
    expect(tag).toContain('r_dos');
  });

  it('escapa el HTML del contenido (los cuerpos llevan SQL con < y >)', async () => {
    const { adapter, enviados } = adaptador();
    await adapter.send([aviso({ body: 'WHERE a <> b AND c > 1' })]);
    expect(enviados[0].html).toContain('&lt;&gt;');
    expect(enviados[0].html).not.toContain('a <> b');
  });

  it('sin credenciales NO lanza: degrada a log (el tick no puede caerse)', async () => {
    const config = { get: () => undefined };
    const adapter = new EmailNotificationAdapter(config as never);
    await expect(adapter.send([aviso()])).resolves.toBeUndefined();
  });

  it('un error de Resend no propaga: el motor de alertas sigue', async () => {
    const { adapter } = adaptador();
    (adapter as unknown as { resend: unknown }).resend = {
      emails: {
        send: async () => {
          throw new Error('boom');
        },
      },
    };
    await expect(adapter.send([aviso()])).resolves.toBeUndefined();
  });
});
