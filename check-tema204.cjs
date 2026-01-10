require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: questions } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      explanation,
      articles!primary_article_id (
        article_number,
        laws!law_id (short_name)
      )
    `)
    .contains('tags', ['Tema 204'])
    .order('created_at', { ascending: true });

  let problemas = [];

  questions?.forEach((q, i) => {
    const art = q.articles;
    const exp = (q.explanation || '').toLowerCase();
    const artNum = art?.article_number;
    const ley = art?.laws?.short_name || '';

    // Detectar si menciona disposición final/adicional/transitoria
    const mencionaDisp = exp.includes('disposición') &&
      (exp.includes('final') || exp.includes('adicional') || exp.includes('transitoria'));

    // Detectar si la explicación menciona RGPD pero vinculado a LO
    const mencionaRGPD = exp.includes('2016/679') || exp.includes('reglamento (ue)');
    const mencionaLO = exp.includes('3/2018') || exp.includes('ley orgánica 3');

    // Verificar si menciona el artículo correcto
    const mencionaArtVinculado = exp.includes('art. ' + artNum) ||
      exp.includes('artículo ' + artNum) ||
      exp.includes('art.' + artNum);

    // Detectar problemas
    let problema = null;

    if (mencionaDisp && artNum === '1') {
      problema = 'Menciona Disposición pero vinculado a Art. 1';
    } else if (mencionaRGPD && !mencionaLO && ley === 'LO 3/2018') {
      problema = 'Menciona solo RGPD pero vinculado a LO 3/2018';
    } else if (!mencionaArtVinculado && artNum === '1') {
      // Fallback a art 1 sin mencionar ningún artículo específico
      const matchArt = exp.match(/artículo\s+(\d+)/i) || exp.match(/art\.\s*(\d+)/i);
      if (matchArt && matchArt[1] !== '1') {
        problema = 'Menciona Art. ' + matchArt[1] + ' pero vinculado a Art. 1 (fallback)';
      }
    }

    if (problema) {
      problemas.push({
        idx: i + 1,
        id: q.id,
        pregunta: q.question_text.substring(0, 70),
        vinculado: 'Art. ' + artNum + ' ' + ley,
        problema: problema,
        explicacion: exp.substring(0, 200)
      });
    }
  });

  console.log('Total preguntas:', questions?.length);
  console.log('Problemas detectados:', problemas.length);

  problemas.forEach(p => {
    console.log('\n=== P' + p.idx + ' ===');
    console.log('PROBLEMA:', p.problema);
    console.log('Pregunta:', p.pregunta + '...');
    console.log('Vinculado:', p.vinculado);
    console.log('Explicación:', p.explicacion + '...');
    console.log('ID:', p.id);
  });
})();
