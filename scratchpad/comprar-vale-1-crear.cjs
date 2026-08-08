// PASO 1 de la compra: crea el invoice SIN pagar (auto_pay:false) y enseña el precio.
// No gasta nada. El pago va en el paso 2, tras comprobar que el precio es sano.
const TOKEN = process.env.BITREFILL_API_TOKEN;
const VALUE = process.argv[2] || '100';
const PRODUCT = process.argv[3] || 'amazon_es-spain';

(async () => {
  const r = await fetch('https://api.bitrefill.com/v2/invoices', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      products: [{ product_id: PRODUCT, value: VALUE, quantity: 1 }],
      payment_method: 'balance',
      auto_pay: false,
    }),
  });
  const j = await r.json();
  console.log('HTTP', r.status);
  console.log(JSON.stringify(j, null, 2));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
