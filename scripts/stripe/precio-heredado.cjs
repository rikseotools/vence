#!/usr/bin/env node
/**
 * scripts/stripe/precio-heredado.cjs — mantenerle a alguien el precio que ya tenía.
 *
 * ## Cuándo se usa
 *
 * Alguien pagaba X €, sube la tarifa (o su suscripción se apaga por una operación
 * nuestra) y decidimos respetarle su precio. Caso origen: Rocío (29/07/2026), 18 €/mes,
 * cuya suscripción entró en el barrido de "no renovar" del 20/07 y al volver se encontró
 * el mensual a 29 €.
 *
 * ## Qué hace
 *
 *   1. Busca a la persona en la BD por email (RDS, no Supabase).
 *   2. Reutiliza o crea un PRICE recurrente con ese importe, identificado por
 *      `lookup_key` (idempotente: dos personas con el mismo precio comparten price).
 *   3. Crea un PAYMENT LINK propio suyo, con `supabase_user_id` en la metadata de la
 *      suscripción — que es lo que el webhook usa para darle premium.
 *   4. Registra la oferta en `user_price_offers`, que es lo que hace que la persona
 *      pueda contratarla en **vence.es/premium/personal** (ve dónde contrata, con la
 *      marca) y lo que permite al checkout comprobar que ese precio es SUYO.
 *   5. Deja rastro en `observable_events` (`legacy_price_link_created`).
 *
 * Payment Link y no Checkout Session a propósito: una sesión de checkout CADUCA a las 24
 * horas, y esto se manda por mensaje a alguien que quizá lo abra en tres días.
 *
 * ## Uso
 *
 *   node scripts/stripe/precio-heredado.cjs crear <email> <importe€> \
 *        [--intervalo mensual|trimestral|semestral|anual] \
 *        [--motivo "texto"] [--feedback <id>] [--cuenta nila|manuel] [--dry-run]
 *
 *   node scripts/stripe/precio-heredado.cjs listar [--cuenta nila]
 *
 * Ejemplo real:
 *   node scripts/stripe/precio-heredado.cjs crear rocioth2810@gmail.com 18 \
 *     --motivo "precio anterior al cambio de tarifa" --feedback 48f1503a-...
 *
 * ⚠️ El plan (mensual/trimestral/…) lo deduce el webhook del INTERVALO, no del importe:
 * no hace falta tocar código para un precio nuevo.
 */
const path = require('path');
const REPO = path.resolve(__dirname, '..', '..');
require(path.join(REPO, 'node_modules', 'dotenv')).config({ path: path.join(REPO, '.env.local') });
const Stripe = require(path.join(REPO, 'node_modules', 'stripe'));
const pgMod = require(path.join(REPO, 'node_modules', 'postgres'));
const postgres = pgMod.default || pgMod;

// El núcleo puro vive en TS (testeado en __tests__/lib/stripe/precioHeredado.test.ts).
// Aquí se replica lo mínimo para no arrastrar un transpilador a un script de operación;
// el guardarraíl de paridad `__tests__/guardrails/precioHeredadoParidad.test.ts` impide
// que las dos copias se separen.
const RECURRENCIA = {
  mensual: { interval: 'month', interval_count: 1 },
  trimestral: { interval: 'month', interval_count: 3 },
  semestral: { interval: 'month', interval_count: 6 },
  anual: { interval: 'year', interval_count: 1 },
};
const ETIQUETA = { mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };

function euroACentimos(euros) {
  if (!Number.isFinite(euros)) throw new Error('El importe no es un número');
  if (euros <= 0) throw new Error('El importe debe ser mayor que 0');
  const c = Math.round(euros * 100);
  if (Math.abs(euros * 100 - c) > 1e-9) throw new Error('El importe no puede tener más de dos decimales');
  return c;
}
const lookupKey = (intervalo, centimos) => `heredado_${intervalo}_${centimos}`;
const nombreProducto = (intervalo) => `Vence Premium ${ETIQUETA[intervalo]}`;

function claveDeCuenta(cuenta) {
  return cuenta === 'nila' ? process.env.STRIPE_SECRET_KEY_NILA : process.env.STRIPE_SECRET_KEY;
}

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const k = argv[i].slice(2);
      if (k === 'dry-run') flags.dryRun = true;
      else flags[k] = argv[++i];
    } else pos.push(argv[i]);
  }
  return { pos, flags };
}

async function emitirEvento(sql, { eventType, severity, userId, metadata }) {
  // Observabilidad best-effort: una operación de dinero nunca falla por el log.
  try {
    await sql`
      INSERT INTO observable_events (source, event_type, severity, user_id, endpoint, metadata)
      VALUES ('cli', ${eventType}, ${severity}, ${userId}, 'scripts/stripe/precio-heredado', ${sql.json(metadata)})
    `;
  } catch (e) {
    console.warn('   ⚠️ no se pudo registrar el evento:', e.message);
  }
}

async function crear({ pos, flags }) {
  const [email, importeRaw] = pos;
  if (!email || !importeRaw) {
    console.error('Uso: crear <email> <importe€> [--intervalo mensual] [--motivo "..."] [--feedback <id>] [--cuenta nila] [--dry-run]');
    process.exit(1);
  }
  const intervalo = flags.intervalo || 'mensual';
  if (!RECURRENCIA[intervalo]) {
    console.error(`Intervalo no válido: ${intervalo}. Opciones: ${Object.keys(RECURRENCIA).join(', ')}`);
    process.exit(1);
  }
  const centimos = euroACentimos(Number(String(importeRaw).replace(',', '.')));
  const motivo = flags.motivo || 'precio anterior al cambio de tarifa';
  const cuenta = flags.cuenta || 'nila'; // las altas nuevas viven en Nila
  const key = claveDeCuenta(cuenta);
  if (!key) { console.error(`Sin clave de Stripe para la cuenta '${cuenta}' en .env.local`); process.exit(1); }

  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, ssl: { rejectUnauthorized: false } });
  const stripe = new Stripe(key, { apiVersion: '2024-06-20' });

  try {
    const [u] = await sql`SELECT id, email, full_name, plan_type, stripe_customer_id, payment_account FROM user_profiles WHERE lower(email) = lower(${email})`;
    if (!u) { console.error(`No hay ningún usuario con el email ${email}`); process.exit(1); }

    console.log(`\n👤 ${u.full_name || '(sin nombre)'} <${u.email}>`);
    console.log(`   plan actual: ${u.plan_type} | cuenta de pago: ${u.payment_account} | cliente: ${u.stripe_customer_id || '(ninguno)'}`);
    console.log(`\n💶 Precio heredado: ${(centimos / 100).toFixed(2)} € ${intervalo} (cuenta ${cuenta})`);
    console.log(`   motivo: ${motivo}`);

    if (flags.dryRun) { console.log('\n🔎 --dry-run: no se ha creado nada.'); return; }

    // 1) Price idempotente por lookup_key
    const lk = lookupKey(intervalo, centimos);
    const existentes = await stripe.prices.list({ lookup_keys: [lk], active: true, limit: 1 });
    let price = existentes.data[0];
    if (price) {
      console.log(`\n♻️  Price reutilizado: ${price.id} (${lk})`);
    } else {
      const producto = await stripe.products.create({
        name: nombreProducto(intervalo),
        metadata: { tipo: 'precio_heredado', intervalo },
      });
      price = await stripe.prices.create({
        product: producto.id,
        currency: 'eur',
        unit_amount: centimos,
        recurring: RECURRENCIA[intervalo],
        lookup_key: lk,
        metadata: { tipo: 'precio_heredado' },
      });
      console.log(`\n🆕 Price creado: ${price.id} (${lk})`);
    }

    // 2) Payment Link propio de esta persona (metadata = vínculo con su cuenta)
    const metadata = {
      supabase_user_id: u.id,
      email: u.email,
      tipo: 'precio_heredado',
      motivo,
      creado_por: 'soporte',
      ...(flags.feedback ? { feedback_id: flags.feedback } : {}),
    };
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata,
      subscription_data: { metadata }, // ← lo que lee el webhook para dar premium
      after_completion: {
        type: 'redirect',
        redirect: { url: 'https://www.vence.es/premium/success' },
      },
    });

    // 3) La oferta como DATO de la persona, no como secreto en una URL.
    // Es lo que hace que pueda contratarla desde vence.es/premium/personal (marca: ve
    // dónde está contratando) y lo que permite al checkout comprobar que el precio es
    // SUYO. Índice único: una sola oferta viva por persona → primero se retira la previa.
    await sql`UPDATE user_price_offers SET revoked_at = now()
              WHERE user_id = ${u.id} AND redeemed_at IS NULL AND revoked_at IS NULL`;
    await sql`INSERT INTO user_price_offers
                (user_id, stripe_price_id, stripe_account, importe_centimos, intervalo,
                 motivo, feedback_id, creado_por, payment_link_url)
              VALUES (${u.id}, ${price.id}, ${cuenta}, ${centimos}, ${intervalo},
                      ${motivo}, ${flags.feedback || null}, 'soporte', ${link.url})`;

    console.log(`\n🔗 ENLACE PARA LA PERSONA (página de Vence):\n   https://www.vence.es/premium/personal\n`);
    console.log(`   Respaldo directo de Stripe (solo si no puede entrar en su cuenta):\n   ${link.url}`);
    console.log(`   (el enlace no caduca; se desactiva con paymentLinks.update('${link.id}', {active:false}))`);

    await emitirEvento(sql, {
      eventType: 'legacy_price_link_created',
      severity: 'info',
      userId: u.id,
      metadata: { email: u.email, cuenta, intervalo, importe_centimos: centimos, price_id: price.id, payment_link: link.id, url: link.url, motivo, feedback_id: flags.feedback || null },
    });
  } finally {
    await sql.end();
  }
}

async function listar({ flags }) {
  const cuenta = flags.cuenta || 'nila';
  const stripe = new Stripe(claveDeCuenta(cuenta), { apiVersion: '2024-06-20' });
  const precios = await stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] });
  const heredados = precios.data.filter((p) => p.lookup_key && p.lookup_key.startsWith('heredado_'));
  console.log(`\n=== Precios heredados vivos en ${cuenta} ===`);
  if (!heredados.length) console.log('  (ninguno)');
  heredados.forEach((p) => console.log(`  ${(p.unit_amount / 100).toFixed(2)} € · ${p.lookup_key} · ${p.id}`));

  const links = await stripe.paymentLinks.list({ active: true, limit: 100 });
  const nuestros = links.data.filter((l) => l.metadata && l.metadata.tipo === 'precio_heredado');
  console.log(`\n=== Enlaces activos (${nuestros.length}) ===`);
  nuestros.forEach((l) => console.log(`  ${l.metadata.email || '?'} · ${l.url} · ${l.metadata.motivo || ''}`));
}

(async () => {
  const [, , cmd, ...resto] = process.argv;
  const args = parseArgs(resto);
  if (cmd === 'crear') return crear(args);
  if (cmd === 'listar') return listar(args);
  console.log(`Uso:
  node scripts/stripe/precio-heredado.cjs crear <email> <importe€> [--intervalo mensual|trimestral|semestral|anual]
                                                [--motivo "..."] [--feedback <id>] [--cuenta nila|manuel] [--dry-run]
  node scripts/stripe/precio-heredado.cjs listar [--cuenta nila]`);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
