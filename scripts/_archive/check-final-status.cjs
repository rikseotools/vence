require('dotenv').config({path:'.env.local'});
const{createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);

(async()=>{
  const bloques = [
    {name: 'Bloque I', tag: 'Bloque I'},
    {name: 'Bloque II', tag: 'Bloque II'},
    {name: 'Bloque III', tag: 'Bloque III'},
    {name: 'Bloque IV', tag: 'Bloque IV'},
    {name: 'Bloque V', tag: 'Bloque V'},
    {name: 'Bloque VI', tag: 'Bloque VI'}
  ];

  console.log('=== ESTADO FINAL POR BLOQUE (Administrativo C1) ===\n');

  let grandTotal = 0;
  let grandPerfect = 0;
  let grandTech = 0;
  let grandPending = 0;

  for(const bloque of bloques) {
    // Count by status using head: true for exact counts
    const {count: total} = await s.from('questions')
      .select('*', {count: 'exact', head: true})
      .eq('is_active', true)
      .contains('tags', [bloque.tag]);

    const {count: perfect} = await s.from('questions')
      .select('*', {count: 'exact', head: true})
      .eq('is_active', true)
      .eq('topic_review_status', 'perfect')
      .contains('tags', [bloque.tag]);

    const {count: tech} = await s.from('questions')
      .select('*', {count: 'exact', head: true})
      .eq('is_active', true)
      .eq('topic_review_status', 'tech_perfect')
      .contains('tags', [bloque.tag]);

    const pending = (total || 0) - (perfect || 0) - (tech || 0);

    grandTotal += total || 0;
    grandPerfect += perfect || 0;
    grandTech += tech || 0;
    grandPending += pending;

    console.log(bloque.name + ':');
    console.log('  Total:', total || 0);
    console.log('  Perfect:', perfect || 0);
    console.log('  Tech Perfect:', tech || 0);
    if(pending > 0) console.log('  ⚠️  Pendientes:', pending);
    else console.log('  ✅ Sin pendientes');
    console.log('');
  }

  console.log('=== RESUMEN TOTAL ===');
  console.log('Total preguntas:', grandTotal);
  console.log('Perfect:', grandPerfect);
  console.log('Tech Perfect:', grandTech);
  console.log('Pendientes:', grandPending);

  if(grandPending === 0) {
    console.log('\n✅ ¡TODAS LAS PREGUNTAS VERIFICADAS!');
  } else {
    console.log('\n⚠️  Aún quedan', grandPending, 'preguntas por revisar');
  }
})();
