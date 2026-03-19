const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // Get the psychometric question
  const { data: q } = await s.from('psychometric_questions')
    .select('*')
    .eq('id', '82be4318-7308-45ce-9c51-f76a833284ca')
    .single();

  if (!q) {
    console.log('Question not found');
    return;
  }

  console.log('ID:', q.id);
  console.log('Type:', q.question_type);
  console.log('Subtype:', q.question_subtype);
  console.log('Question:', q.question_text);
  console.log('Option A:', q.option_a);
  console.log('Option B:', q.option_b);
  console.log('Option C:', q.option_c);
  console.log('Option D:', q.option_d);
  console.log('Correct:', q.correct_option, '→', ['A', 'B', 'C', 'D'][q.correct_option]);
  console.log('Explanation:', q.explanation);
  console.log('Difficulty:', q.difficulty);

  // Verify the math
  console.log('\n--- VERIFICATION ---');
  // Pattern from AMOR → CNQT
  const alpha = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'; // Spanish 27 letters
  const alphaEn = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // English 26 letters

  for (const [name, alph] of [['Spanish (27)', alpha], ['English (26)', alphaEn]]) {
    console.log(`\n${name}:`);
    const pos = (c) => alph.indexOf(c) + 1;

    console.log('AMOR:', 'A'.split('').map(x => `A=${pos('A')}`).join(', '));
    console.log(`A(${pos('A')})→C(${pos('C')}): +${pos('C')-pos('A')}`);
    console.log(`M(${pos('M')})→N(${pos('N')}): +${pos('N')-pos('M')}`);
    console.log(`O(${pos('O')})→Q(${pos('Q')}): +${pos('Q')-pos('O')}`);
    console.log(`R(${pos('R')})→T(${pos('T')}): +${pos('T')-pos('R')}`);

    const pattern = [pos('C')-pos('A'), pos('N')-pos('M'), pos('Q')-pos('O'), pos('T')-pos('R')];
    console.log('Pattern:', pattern);

    const vida = 'VIDA';
    let result = '';
    for (let i = 0; i < vida.length; i++) {
      const newPos = pos(vida[i]) + pattern[i];
      result += alph[newPos - 1];
    }
    console.log(`VIDA + pattern = ${result}`);
  }
})();
