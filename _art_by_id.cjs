require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const id=process.argv[2];
  const {data}=await s.from('articles').select('article_number,title,content,law_id').eq('id',id).single();
  if(!data){console.log('NO');return;}
  const {data:law}=await s.from('laws').select('short_name').eq('id',data.law_id).single();
  console.log('LEY:'+(law?.short_name||'')+' ART:'+data.article_number+' '+(data.title||''));
  console.log('CONTENIDO:\n'+(data.content||'').slice(0,2200));
})();
