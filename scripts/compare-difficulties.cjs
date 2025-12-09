const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  let allQuestions = [];
  let from = 0;
  const pageSize = 1000;

  console.log('Obteniendo preguntas...');

  while (true) {
    const { data } = await supabase
      .from('questions')
      .select('difficulty, global_difficulty_category')
      .not('global_difficulty_category', 'is', null)
      .not('difficulty', 'is', null)
      .range(from, from + pageSize - 1);

    if (!data || data.length === 0) break;
    allQuestions.push(...data);
    from += pageSize;
  }

  console.log('');
  console.log('📊 COMPARACIÓN COMPLETA: Estática vs Calculada');
  console.log('='.repeat(60));
  console.log('Total preguntas:', allQuestions.length);
  console.log('');

  const matrix = {};
  const categories = ['easy', 'medium', 'hard', 'extreme'];

  categories.forEach(s => {
    matrix[s] = {};
    categories.forEach(c => matrix[s][c] = 0);
  });

  let coinciden = 0;
  let difieren = 0;

  allQuestions.forEach(q => {
    if (q.difficulty && q.global_difficulty_category) {
      matrix[q.difficulty][q.global_difficulty_category]++;
      if (q.difficulty === q.global_difficulty_category) coinciden++;
      else difieren++;
    }
  });

  console.log('📈 RESUMEN:');
  console.log('  Coinciden ✅:', coinciden, `(${((coinciden/allQuestions.length)*100).toFixed(1)}%)`);
  console.log('  Difieren 🔄:', difieren, `(${((difieren/allQuestions.length)*100).toFixed(1)}%)`);
  console.log('');

  console.log('📊 MATRIZ (Fila=Estática, Columna=Calculada):');
  console.log('');
  console.log('Estática    →  Easy   Medium   Hard  Extreme  TOTAL');
  console.log('-'.repeat(60));

  let totalPorCat = {};
  categories.forEach(s => {
    const counts = categories.map(c => matrix[s][c]);
    const total = counts.reduce((a,b) => a+b, 0);
    totalPorCat[s] = total;
    console.log(`${s.padEnd(12)} ${counts.map(c => String(c).padStart(6)).join('')}  ${String(total).padStart(5)}`);
  });

  console.log('');
  console.log('🔍 TOP CAMBIOS:');
  const cambios = [];
  categories.forEach(s => {
    categories.forEach(c => {
      if (s !== c && matrix[s][c] > 0) {
        cambios.push({
          from: s, to: c, count: matrix[s][c],
          pct: ((matrix[s][c]/totalPorCat[s])*100).toFixed(1)
        });
      }
    });
  });
  cambios.sort((a,b) => b.count - a.count);
  cambios.slice(0,10).forEach(c => {
    console.log(`  ${c.from.padEnd(8)} → ${c.to.padEnd(8)}: ${String(c.count).padStart(4)} (${c.pct}%)`);
  });
})();
