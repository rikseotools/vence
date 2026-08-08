// PASO 2: paga un invoice YA CREADO y espera la entrega del código.
const TOKEN = process.env.BITREFILL_API_TOKEN;
const ID = process.argv[2];
// Guarda anti-overspend: se pasa a mano el techo esperado (100 € ≈ 181k sats, 200 € ≈ 356k).
const MAX_SATS = Number(process.argv[3] || 300000);

const bf = async (path, method = 'GET') => {
  const r = await fetch('https://api.bitrefill.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

(async () => {
  if (!ID) throw new Error('falta invoice id');

  const pre = await bf('/v2/invoices/' + ID);
  const price = pre.body?.data?.payment?.price;
  console.log('precio (sats):', price, '· estado pago:', pre.body?.data?.payment?.status);
  if (!price || price > MAX_SATS) throw new Error('precio fuera de rango, NO pago: ' + price);
  if (pre.body?.data?.payment?.status === 'paid') console.log('⚠️ ya estaba pagado');

  const pay = await bf('/v2/invoices/' + ID + '/pay', 'POST');
  console.log('PAY HTTP', pay.status, JSON.stringify(pay.body?.data?.payment || pay.body));

  for (let i = 0; i < 10; i++) {
    const inv = await bf('/v2/invoices/' + ID);
    const d = inv.body?.data;
    console.log('intento', i + 1, '· status:', d?.status, '· order:', d?.orders?.[0]?.status);
    if (d?.orders?.[0]?.redemption_info) {
      console.log('ENTREGADO:');
      console.log(JSON.stringify({ invoice: d.id, order: d.orders[0].id, price: d.payment?.price, redemption_info: d.orders[0].redemption_info }, null, 2));
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  console.log('⚠️ sin redemption_info tras los reintentos — revisar a mano el invoice', ID);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
