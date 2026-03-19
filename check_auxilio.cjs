require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get auxilio judicial page to see block structure
  const { data } = await supabase.from('topics')
    .select('topic_number, title, description')
    .eq('position_type', 'auxilio_judicial')
    .order('topic_number');

  for (const t of (data || [])) {
    console.log('T' + t.topic_number + ':', t.title);
  }

  // Check how tramitacion-procesal page defines blocks
  console.log('\nTotal:', data?.length, 'topics');
})();
