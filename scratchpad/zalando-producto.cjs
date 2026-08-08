const TOKEN = process.env.BITREFILL_API_TOKEN;
(async () => {
  const r = await fetch('https://api.bitrefill.com/v2/products/zalando-spain', {
    headers: { Authorization: 'Bearer ' + TOKEN },
  });
  const j = await r.json();
  const d = j.data || j;
  console.log(JSON.stringify({
    id: d.id, name: d.name, currency: d.currency, country: d.country,
    packages: (d.packages || []).map((p) => p.value),
    redemption_methods: d.redemption_methods,
    instructions: d.instructions || d.redeem_instructions || d.description,
    terms: (d.terms_and_conditions || '').slice(0, 800),
    website: d.website || d.link,
  }, null, 2));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
