// Registra el vale Zalando 200 € ya comprado (retirada del propietario, §3.ter).
// `method` va con el de la marca (`zalando_giftcard`) para que la tarjeta la derive bien (§3.ter.bis).
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

const UID = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'; // manueltrader@gmail.com

const REF = {
  code: 'P3CXZXEZ6PMDE4E2',
  pin: '',
  serial: '',
  _invoice_id: 'ec224881-6ec1-4127-8109-1759ad5e59c5',
  _order_id: '6a75f4f23afd3796269f53e5',
  _price_sats: 355963,
  _product: 'zalando-spain',
  _expiration_date: '2031-08-03T13:24:13.635Z',
  _purchased_at: '2026-08-07T15:08:34.762Z',
  _note: 'retirada del propietario — vale Zalando España 200 € pedido por Manuel el 07/08/2026',
};

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  const dup = await c.query('SELECT id FROM reward_payouts WHERE giftcard_ref LIKE $1', ['%' + REF._invoice_id + '%']);
  if (dup.rowCount) { console.log('⚠️ ese invoice YA está registrado:', dup.rows); await c.end(); return; }

  const r = await c.query(
    "INSERT INTO reward_payouts (beneficiary_user_id, amount, method, purchased_via, giftcard_ref, status, approved_by, paid_at, reason) " +
    "VALUES ($1, $2, 'zalando_giftcard', 'bitrefill', $3, 'paid', $1, now(), 'owner_withdrawal') " +
    "RETURNING id, amount, method, reason, status, paid_at",
    [UID, '200.00', JSON.stringify(REF)]
  );
  console.table(r.rows);
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
