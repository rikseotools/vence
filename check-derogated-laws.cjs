const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function checkIfDerogated(html) {
  const patterns = [
    /Disposición derogada/i,
    /Esta norma ha sido derogada/i,
    /Norma derogada/i,
    /derogada por/i,
    /Vigencia agotada/i,
    /Sin vigencia/i,
    /<span[^>]*class="[^"]*derogado[^"]*"/i,
    /class="estado"[^>]*>.*?Derogad/i,
    /Texto derogado/i
  ];

  for (const pattern of patterns) {
    if (pattern.test(html)) {
      const match = html.match(pattern);
      return { derogated: true, reason: match[0].substring(0, 50) };
    }
  }
  return { derogated: false };
}

async function main() {
  console.log('Obteniendo leyes de la base de datos...\n');

  const { data: laws, error } = await supabase
    .from('laws')
    .select('id, short_name, name, boe_url')
    .not('boe_url', 'is', null)
    .order('short_name');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total: ${laws.length} leyes con URL BOE\n`);
  console.log('Verificando estado de vigencia...\n');

  const derogated = [];
  const errors = [];
  let checked = 0;

  for (const law of laws) {
    try {
      const html = await fetchUrl(law.boe_url);
      const result = checkIfDerogated(html);

      checked++;
      process.stdout.write(`\rVerificando: ${checked}/${laws.length}`);

      if (result.derogated) {
        derogated.push({
          short_name: law.short_name,
          name: law.name,
          boe_url: law.boe_url,
          reason: result.reason
        });
      }

      // Pausa para no sobrecargar el BOE
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      errors.push({ short_name: law.short_name, error: err.message });
    }
  }

  console.log('\n\n=== RESULTADOS ===\n');

  if (derogated.length > 0) {
    console.log(`🚨 LEYES POSIBLEMENTE DEROGADAS (${derogated.length}):\n`);
    derogated.forEach(law => {
      console.log(`  ❌ ${law.short_name}`);
      console.log(`     ${law.name || ''}`);
      console.log(`     Razón: ${law.reason}`);
      console.log(`     URL: ${law.boe_url}\n`);
    });
  } else {
    console.log('✅ No se encontraron leyes derogadas\n');
  }

  if (errors.length > 0) {
    console.log(`\n⚠️ ERRORES (${errors.length}):`);
    errors.forEach(e => console.log(`  - ${e.short_name}: ${e.error}`));
  }

  console.log(`\n📊 Resumen: ${laws.length} verificadas, ${derogated.length} posiblemente derogadas, ${errors.length} errores`);
}

main();
