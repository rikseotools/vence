// Registra el vale Amazon.es 100 € ya comprado (retirada del propietario, §3.ter).
const { Client } = require('pg');
const { pgConfig } = require('../lib/db/pgSsl.cjs');

const UID = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'; // manueltrader@gmail.com

const REF = {
  code: 'E35N-TMZLS9-9ZB7',
  pin: '',
  serial: '',
  _invoice_id: 'd0f9ed05-ef1b-4323-8a19-b2d7fe7ada70',
  _order_id: '6a7606b8933d2275d06ca0e0',
  _price_sats: 181689,
  _product: 'amazon_es-spain',
  _purchased_at: '2026-08-07T16:10:00.000Z',
  _note: 'retirada del propietario — vale Amazon.es 100 € pedido por Manuel el 07/08/2026',
};

(async () => {
  const c = new Client(pgConfig(process.env.DATABASE_URL));
  await c.connect();

  const dup = await c.query('SELECT id FROM reward_payouts WHERE giftcard_ref LIKE $1', ['%' + REF._invoice_id + '%']);
  if (dup.rowCount) { console.log('⚠️ ese invoice YA está registrado:', dup.rows); await c.end(); return; }

  const r = await c.query(
    "INSERT INTO reward_payouts (beneficiary_user_id, amount, method, purchased_via, giftcard_ref, status, approved_by, paid_at, reason) " +
    "VALUES ($1, $2, 'amazon_giftcard', 'bitrefill', $3, 'paid', $1, now(), 'owner_withdrawal') " +
    "RETURNING id, amount, method, reason, status, paid_at",
    [UID, '100.00', JSON.stringify(REF)]
  );
  console.table(r.rows);
  await c.end();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
