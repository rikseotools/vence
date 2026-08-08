// PASO 3: registra en reward_payouts el vale ya comprado (retirada del propietario, §3.ter).
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

const UID = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'; // manueltrader@gmail.com

const REF = {
  code: 'EJNA-R4P2B3-3XBK',
  pin: '',
  serial: '',
  _invoice_id: 'a1a156a6-d01f-4ae9-a110-670e03474633',
  _order_id: '6a75ef8a3afd3796269efc1b',
  _fallback_link: 'https://revealyourgift.com/292d9691-2652-43d1-bee9-9bc9fc949f2b/a134ae6f-9c0d-4c7c-969b-8c6c108e5ad8',
  _price_sats: 181090,
  _product: 'amazon_es-spain',
  _purchased_at: '2026-08-07T14:45:30.510Z',
  _note: 'retirada del propietario — vale Amazon.es 100 € pedido por Manuel el 07/08/2026',
};

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  const dup = await c.query(
    "SELECT id FROM reward_payouts WHERE giftcard_ref LIKE $1", ['%' + REF._invoice_id + '%']
  );
  if (dup.rowCount) { console.log('⚠️ ese invoice YA está registrado:', dup.rows); await c.end(); return; }

  const r = await c.query(
    "INSERT INTO reward_payouts (beneficiary_user_id, amount, method, purchased_via, giftcard_ref, status, approved_by, paid_at, reason) " +
    "VALUES ($1, $2, 'amazon_giftcard', 'bitrefill', $3, 'paid', $1, now(), 'owner_withdrawal') " +
    "RETURNING id, amount, reason, status, purchased_via, paid_at",
    [UID, '100.00', JSON.stringify(REF)]
  );
  console.table(r.rows);
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
