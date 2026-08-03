/**
 * sim-reconciliador-feedback.ts — el reconciliador de [T-501] contra DATOS REALES.
 *
 * Importa el servicio REAL (`FeedbackEmailReconciliationService`), nunca una copia: una
 * copia del SQL da falso verde en cuanto el servicio cambia, y aquí lo que hay que probar
 * es justo el SQL — el núcleo del veredicto ya tiene sus tests puros.
 *
 * NO escribe nada: solo lee. Dos pasadas:
 *   1. La VENTANA REAL (24 h), que es lo que hará el cron cada hora en Fargate.
 *   2. La CALIBRACIÓN a 90 días, que es lo que justifica que la alerta no sea ruido:
 *      el 03/08/2026 daba 532 respuestas de admin, 43 sin email, y de esas **42 saltos
 *      legítimos y 1 pérdida real** (`garciamoyanoraquel7179@`, 14/07 — se le contestó
 *      cómo evitar el siguiente cobro y el correo no salió; nadie se enteró en 20 días).
 *      Y un control que tiene que dar 100%: de las que SÍ tienen email, cuántas tienen
 *      token. Si ese control baja, el discriminante ha dejado de servir y el veredicto
 *      empieza a mentir en la dirección peligrosa.
 *
 * Uso:  npm run sim:reconciliador-feedback
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
for (const p of ['.env.local', '../.env.local']) {
  if (fs.existsSync(path.resolve(p))) {
    dotenv.config({ path: path.resolve(p) });
    break;
  }
}
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { FeedbackEmailReconciliationService } from '../src/feedback-email-reconciliation/feedback-email-reconciliation.service';
import type { DrizzleDB } from '../src/db/database.module';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('falta DATABASE_URL (.env.local)');
  const client = postgres(url, { max: 2 });
  const db = drizzle(client) as unknown as DrizzleDB;

  // ── 1. La ventana real ────────────────────────────────────────────────────────────
  const service = new FeedbackEmailReconciliationService(db);
  const r = await service.run();
  console.log('\n=== VENTANA REAL (24 h) — lo que hará el cron ===');
  console.log(`  sin email:        ${r.withoutEmail}`);
  console.log(`  drops REALES:     ${r.realDrops}   ← lo único que dispara la alerta`);
  console.log(`  saltos legítimos: ${r.expectedSkips}`);
  console.log(`  inferidos:        ${r.inferredSkips}   ← trinquete: debe tender a 0`);
  console.log(`  duración:         ${r.durationMs} ms`);
  for (const s of r.sample) {
    console.log(
      `   · ${s.sentAt}  ${s.email}  msg=${s.messageId}` +
        (s.conToken ? '  [CON TOKEN → certeza, el envío pasó el gate]' : ''),
    );
  }

  // ── 2. Calibración a 90 días + el control del discriminante ───────────────────────
  const [cal] = (await db.execute(sql`
    WITH msgs AS (
      SELECT m.id message_id, m.created_at, fc.user_id
      FROM feedback_messages m
      JOIN feedback_conversations fc ON fc.id = m.conversation_id
      WHERE m.is_admin = true AND fc.user_id IS NOT NULL
        AND m.created_at >= now() - interval '90 days'
        AND m.created_at <= now() - interval '10 minutes'
    ), cl AS (
      SELECT ms.*,
        EXISTS (SELECT 1 FROM email_events ee
                WHERE ee.email_address = up.email AND ee.email_type = 'soporte_respuesta'
                  AND ee.created_at >= ms.created_at - interval '2 minutes'
                  AND ee.created_at <= ms.created_at + interval '30 minutes') has_email,
        EXISTS (SELECT 1 FROM email_unsubscribe_tokens t
                WHERE t.user_id = ms.user_id AND t.email_type = 'soporte_respuesta'
                  AND t.created_at >= ms.created_at - interval '2 minutes'
                  AND t.created_at <= ms.created_at + interval '30 minutes') has_token
      FROM msgs ms JOIN user_profiles up ON up.id = ms.user_id
    )
    SELECT count(*)::int total,
           count(*) FILTER (WHERE has_email)::int con_email,
           count(*) FILTER (WHERE has_email AND has_token)::int control_token,
           count(*) FILTER (WHERE NOT has_email)::int sin_email,
           count(*) FILTER (WHERE NOT has_email AND has_token)::int drops_con_certeza
    FROM cl
  `)) as unknown as Array<Record<string, number>>;

  const pct = cal.con_email ? (100 * cal.control_token) / cal.con_email : 0;
  console.log('\n=== CALIBRACIÓN (90 días) ===');
  console.log(`  respuestas de admin:      ${cal.total}`);
  console.log(`  con email:                ${cal.con_email}`);
  console.log(`  sin email:                ${cal.sin_email}`);
  console.log(`  de esas, CON token:       ${cal.drops_con_certeza}   ← pérdidas ciertas`);
  console.log(
    `  CONTROL del discriminante: ${cal.control_token}/${cal.con_email} (${pct.toFixed(1)}%) de las entregadas tienen token`,
  );
  if (pct < 99) {
    console.log(
      '\n  ⚠️  El control ha bajado del 99%: el token ha dejado de probar que el envío ' +
        'pasó el gate. Revisar sendEmailV2 ANTES de fiarse de un veredicto de este cron.',
    );
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
