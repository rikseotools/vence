const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: matches } = await supabase
    .from('questions')
    .select('id, question_text, correct_option, explanation')
    .eq('id', '108c81a4-c2e1-40a9-8b58-5f16c2636b6c');

  if (!matches || matches.length === 0) {
    console.log('No encontrada con prefijo 108c81a4');
    return;
  }

  const q = matches[0];
  console.log('Encontrada:', q.id);
  console.log('Q:', q.question_text?.substring(0, 120));
  console.log('Correcta:', ['A','B','C','D'][q.correct_option]);

  const nuevaExplicacion = `La respuesta correcta es A.

Según el artículo 138 de la Ley 7/1985, Reguladora de las Bases del Régimen Local, la Conferencia de ciudades está integrada por:

- La **Administración General del Estado**
- Las **comunidades autónomas**
- Los **alcaldes de los municipios** comprendidos en el ámbito de aplicación del Título X de esta Ley (municipios de gran población)

"Un representante por provincia de los municipios de la misma en riesgo de despoblación" **NO** forma parte de la Conferencia de ciudades, por lo que es el elemento que no está incluido en su composición.`;

  const { error } = await supabase
    .from('questions')
    .update({
      explanation: nuevaExplicacion,
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString(),
      verification_status: 'ok'
    })
    .eq('id', q.id);

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('\n✅ Explicación corregida y marcada como perfect');
  }
}

main().catch(console.error);
