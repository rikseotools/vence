require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const topicId = '9fa3e8bb-cd6b-4953-bdb5-d021ba921dd1'; // Tema 10 aux admin

  // Find CE entries for this topic
  const { data: scope } = await supabase
    .from('topic_scope')
    .select('id, article_numbers, laws:law_id(short_name)')
    .eq('topic_id', topicId);

  const ceEntry = (scope || []).find(s => s.laws && s.laws.short_name === 'CE');
  if (!ceEntry) {
    console.log('No se encontró entrada CE');
    return;
  }

  console.log('Eliminando:', ceEntry.id, '| CE | articles:', JSON.stringify(ceEntry.article_numbers));

  const { error } = await supabase
    .from('topic_scope')
    .delete()
    .eq('id', ceEntry.id);

  if (error) console.error('Error:', error);
  else console.log('Eliminada OK');
})();
