// Catálogo Bitrefill para España: qué tarjetas regalo de ROPA/MODA hay y con qué denominaciones.
const TOKEN = process.env.BITREFILL_API_TOKEN;

const bf = async (path) => {
  const r = await fetch('https://api.bitrefill.com' + path, {
    headers: { Authorization: 'Bearer ' + TOKEN },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

(async () => {
  const todos = [];
  let start = 0;
  for (let p = 0; p < 12; p++) {
    const r = await bf(`/v2/products?limit=100&start=${start}&country=ES`);
    const data = r.body?.data || [];
    if (!data.length) break;
    todos.push(...data);
    start += 100;
  }
  console.log('productos ES:', todos.length);

  const cats = new Map();
  for (const p of todos) {
    const k = (p.categories || []).join('|') || '(sin categoría)';
    cats.set(k, (cats.get(k) || 0) + 1);
  }
  console.log('\nCATEGORÍAS:');
  [...cats.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(' ', n, k));

  const ROPA = /cloth|apparel|fashion|shoe|sport|moda|ropa/i;
  const ropa = todos.filter(
    (p) => ROPA.test((p.categories || []).join(' ')) || ROPA.test(p.name || '')
  );
  console.log('\nCANDIDATOS DE ROPA/MODA/DEPORTE:');
  for (const p of ropa) {
    const vals = (p.packages || []).map((x) => x.value).join('/');
    console.log(` · ${p.name}  [${p.id}]  cat=${(p.categories || []).join(',')}  valores=${vals || '?'}  ${p.currency || ''}`);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
