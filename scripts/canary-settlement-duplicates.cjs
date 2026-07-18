#!/usr/bin/env node
// Canary anti-regresión: verifica que payment_settlements NO tiene filas duplicadas
// por stripe_invoice_id (bug 07/07 — dos eventos de webhook por el mismo pago).
// El índice único parcial (migración 20260718) lo impide a nivel BD; este canary
// caza si el índice se cae, se cambia el flujo, o entra un duplicado por otra vía.
//
// Exit 0 = limpio. Exit 1 = hay duplicados (los lista). Cron/manual.
//   node scripts/canary-settlement-duplicates.cjs
const fs = require('fs');
function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(require('path').join(__dirname, '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
const sql = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'postgres'))(
  getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 }
);
(async () => {
  let bad = false;
  try {
    // 1. Duplicados por factura
    const dups = await sql`
      SELECT stripe_invoice_id AS inv, count(*)::int n, sum(amount_gross)::int bruto
      FROM public.payment_settlements
      WHERE stripe_invoice_id IS NOT NULL
      GROUP BY 1 HAVING count(*) > 1
      ORDER BY n DESC`;
    if (dups.length) {
      bad = true;
      console.error(`❌ ${dups.length} factura(s) con settlement DUPLICADO:`);
      dups.forEach((d) => console.error(`   ${d.inv} × ${d.n}  (${(d.bruto / 100).toFixed(0)}€ contados de más)`));
    } else {
      console.log('✅ 0 duplicados por stripe_invoice_id.');
    }
    // 2. El índice único debe existir (si alguien lo borra, el guard desaparece)
    const [idx] = await sql`SELECT 1 FROM pg_indexes WHERE indexname = 'payment_settlements_stripe_invoice_id_key'`;
    if (!idx) { bad = true; console.error('❌ Falta el índice único payment_settlements_stripe_invoice_id_key.'); }
    else console.log('✅ Índice único por factura presente.');
  } catch (e) {
    bad = true;
    console.error('ERROR canary:', e.message);
  } finally {
    await sql.end();
  }
  process.exit(bad ? 1 : 0);
})();
