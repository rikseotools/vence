require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TEMA6_ID = '31d21a36-6e96-40b3-a706-dc473267071d';
const LAWS = {
  LOPJ: 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff',
  EOMF: '8f8cb31f-c8ca-4967-9fa6-6fc94d77a932',
  CE: '6ad91a6c-41ec-431f-9c80-5f5566834941'
};

async function main() {
  // Leer preguntas importadas
  const questions = JSON.parse(fs.readFileSync('/tmp/tema6-ready-to-import.json'));

  // Agrupar artículos por ley
  const articlesByLaw = {};

  for (const q of questions) {
    if (!q.verified_law || !q.verified_article_number) continue;

    const lawId = LAWS[q.verified_law];
    if (!lawId) continue;

    if (!articlesByLaw[lawId]) articlesByLaw[lawId] = new Set();
    articlesByLaw[lawId].add(q.verified_article_number);
  }

  console.log('=== ACTUALIZANDO TOPIC_SCOPE ===');

  for (const [lawId, artSet] of Object.entries(articlesByLaw)) {
    const artNumbers = Array.from(artSet);

    // Obtener scope actual
    const { data: existing } = await supabase
      .from('topic_scope')
      .select('article_numbers')
      .eq('topic_id', TEMA6_ID)
      .eq('law_id', lawId)
      .single();

    const currentArts = existing?.article_numbers || [];
    const merged = [...new Set([...currentArts, ...artNumbers])];
    const newCount = merged.length - currentArts.length;

    // Upsert
    const { error } = await supabase
      .from('topic_scope')
      .upsert({
        topic_id: TEMA6_ID,
        law_id: lawId,
        article_numbers: merged
      }, { onConflict: 'topic_id,law_id' });

    // Obtener nombre de ley
    const lawName = Object.entries(LAWS).find(([k, v]) => v === lawId)?.[0] || lawId;

    if (error) {
      console.log(lawName + ': Error -', error.message);
    } else {
      console.log(lawName + ': ' + currentArts.length + ' → ' + merged.length + ' artículos (+' + newCount + ')');
    }
  }
}

main().catch(console.error);
