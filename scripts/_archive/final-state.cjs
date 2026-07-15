const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  console.log('=== ESTADO FINAL DE PREGUNTAS POR TEMA ===\n');

  const bloques = [
    { name: 'BLOQUE I - Organización del Estado', start: 1, end: 11, prefix: 'T1' },
    { name: 'BLOQUE II - Procedimiento Administrativo', start: 1, end: 4, prefix: 'T2', offset: 200 },
    { name: 'BLOQUE III - Derecho Administrativo', start: 1, end: 7, prefix: 'T3', offset: 300 },
    { name: 'BLOQUE IV - Personal', start: 1, end: 9, prefix: 'T4', offset: 400 },
    { name: 'BLOQUE V - Presupuestos', start: 1, end: 6, prefix: 'T5', offset: 500 },
    { name: 'BLOQUE VI - Informática', start: 1, end: 8, prefix: 'T6', offset: 600 }
  ];

  let grandTotal = 0;

  for (const bloque of bloques) {
    console.log(bloque.name + ':');
    let bloqueTotal = 0;

    for (let i = bloque.start; i <= bloque.end; i++) {
      const tag = bloque.prefix + String(i).padStart(2, '0');
      const { count } = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .contains('tags', [tag])
        .eq('is_active', true);

      if (count > 0) {
        console.log('  ' + tag + ': ' + count);
        bloqueTotal += count;
      } else {
        console.log('  ' + tag + ': 0 ⚠️');
      }
    }
    console.log('  Subtotal: ' + bloqueTotal + '\n');
    grandTotal += bloqueTotal;
  }

  // Total general en BD
  const { count: totalBD } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  console.log('═══════════════════════════════════');
  console.log('TOTAL con tags de tema: ' + grandTotal);
  console.log('TOTAL en BD: ' + totalBD);
  console.log('Sin tag de tema: ' + (totalBD - grandTotal));
})();
