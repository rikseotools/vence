const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LETTER_TO_INDEX = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };

const data = JSON.parse(fs.readFileSync('/home/manuel/Documentos/github/vence/preguntas-para-subir/examenes-oficiales/oficial_2026-01-06.json', 'utf8'));

// Mapeo de preguntas (1-based index) a artículos virtuales
const mapping = {
  48: { law: 'Informática Básica', art: '4', tag: 'T601' },  // Windows - Software
  49: { law: 'Informática Básica', art: '4', tag: 'T601' },  // Explorador - Software
  52: { law: 'Informática Básica', art: '4', tag: 'T601' },  // Accesorios Windows - Software
  53: { law: 'Procesadores de texto', art: '4', tag: 'T604' },  // Word Correspondencia
  54: { law: 'Procesadores de texto', art: '1', tag: 'T604' },  // Word funciones
  56: { law: 'Procesadores de texto', art: '4', tag: 'T604' },  // Word Reglas/Correspondencia
  57: { law: 'Hojas de cálculo. Excel', art: '4', tag: 'T605' },  // Excel fórmulas
  58: { law: 'Hojas de cálculo. Excel', art: '4', tag: 'T605' },  // Excel MEDIANA
  62: { law: 'Base de datos: Access', art: '2', tag: 'T606' },  // Access tablas
  67: { law: 'Informática Básica', art: '2', tag: 'T601' },  // Correo - Introducción
};

const lawCache = {};
const artCache = {};

async function getArticle(lawName, artNum) {
  const key = lawName + '-' + artNum;
  if (artCache[key]) return artCache[key];

  if (!lawCache[lawName]) {
    const { data } = await supabase.from('laws').select('id').eq('short_name', lawName).single();
    lawCache[lawName] = data?.id;
  }

  const { data } = await supabase.from('articles').select('id')
    .eq('law_id', lawCache[lawName]).eq('article_number', artNum).eq('is_active', true).single();
  artCache[key] = data?.id;
  return data?.id;
}

(async () => {
  console.log('Insertando preguntas de Informática:\n');

  for (const [idx, config] of Object.entries(mapping)) {
    const q = data.questions[parseInt(idx) - 1];  // Convert to 0-based
    const articleId = await getArticle(config.law, config.art);

    if (!articleId) {
      console.log(idx + '. ❌ Art no encontrado: ' + config.law + ' Art.' + config.art);
      continue;
    }

    const { error } = await supabase.from('questions').insert({
      question_text: q.question,
      option_a: q.options.find(o => o.letter === 'A')?.text || '',
      option_b: q.options.find(o => o.letter === 'B')?.text || '',
      option_c: q.options.find(o => o.letter === 'C')?.text || '',
      option_d: q.options.find(o => o.letter === 'D')?.text || '',
      correct_option: LETTER_TO_INDEX[q.correctAnswer],
      explanation: q.explanation || '',
      primary_article_id: articleId,
      difficulty: 'medium',
      is_active: true,
      is_official_exam: true,
      exam_position: 'administrativo',
      exam_source: 'OpositaTest - Examen Oficial C1',
      tags: ['Oficial C1', config.tag, 'Bloque VI']
    });

    console.log(idx + '.', error ? '❌ ' + error.message : '✅ ' + config.law + ' Art.' + config.art);
  }

  // Contar total oficiales
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('is_official_exam', true);

  console.log('\n📈 Total preguntas oficiales: ' + count);
})();
