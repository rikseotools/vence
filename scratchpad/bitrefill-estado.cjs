// Estado previo a una compra: saldo Bitrefill + vales ya emitidos a la cuenta destino.
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

const UID = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'; // manueltrader@gmail.com
const TOKEN = process.env.BITREFILL_API_TOKEN;

async function bf(path) {
  const r = await fetch('https://api.bitrefill.com' + path, {
    headers: { Authorization: 'Bearer ' + TOKEN },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

(async () => {
  console.log('TOKEN presente:', Boolean(TOKEN));
  const bal = await bf('/v2/accounts/balance');
  console.log('SALDO:', JSON.stringify(bal, null, 2));

  const prod = await bf('/v2/products/amazon_es-spain');
  const packs = prod.body?.data?.packages || prod.body?.packages || [];
  console.log('DENOMINACIONES amazon_es-spain:', packs.map((p) => p.value).join(', '));

  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();
  const p = await c.query(
    "SELECT amount, status, reason, purchased_via, paid_at, created_at FROM reward_payouts " +
    "WHERE beneficiary_user_id = $1 ORDER BY created_at DESC LIMIT 20", [UID]
  );
  console.log('VALES YA EMITIDOS A ESA CUENTA:');
  console.table(p.rows);
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
