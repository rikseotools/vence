require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data } = await supabase
    .from('topic_scope')
    .select('id, article_numbers, laws:law_id(short_name), topics:topic_id(topic_number, title, position_type)')
    .order('id');

  const empty = (data || []).filter(s => !s.article_numbers || s.article_numbers.length === 0);

  console.log('Total entries:', data?.length);
  console.log('Entries con articles vacío/null:', empty.length);
  console.log('');
  for (const s of empty) {
    console.log(
      s.topics?.position_type + ' T' + s.topics?.topic_number,
      '|', s.laws?.short_name,
      '| articles:', JSON.stringify(s.article_numbers)
    );
  }
})();
