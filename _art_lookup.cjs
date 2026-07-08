// node _art_lookup.cjs <law_key> <article_number>  → imprime contenido del artículo
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const L = {
  gobierno:'c734aa2f-69fe-44d1-8d14-744517e4c580', trebep:'e602d0b8-1529-4c04-9bd1-8dccdbd5baa0',
  fpext:'ce3db3a0-6645-442a-8342-db0dec0c7ae6', convenio:'6287fe50-03eb-4dcf-a566-c3328de124d7',
  jornada:'9f0503f8-05f3-431b-b9ac-1d8db50ff9af', ingreso:'5bae2d9e-8dd8-41f3-adb0-54a98cc7a518',
  lprl:'8b1ae300-4ed3-4019-876c-780ea40ebbfe', lo32007:'6e59eacd-9298-4164-9d78-9e9343d9a900',
  lo12004:'f5c17b23-2547-43d2-800c-39f5ea925c2f', igualext:'631e1a64-8aa9-4d9f-9850-a88a9e755930',
  ley40:'95680d57-feb1-41c0-bb27-236024815feb', ley39:'218452f5-b9f6-48f0-a25b-26df9cb19644',
  aeext:'144b8b92-7f1d-4ff0-b83c-0cfe8515cd10', lghp:'d47fcaab-f099-499f-b47b-1996db4f71d6',
  ley9:'4f605392-8137-4962-9e66-ca5f275e93ee', estatuto:'df9a2910-6b33-465f-aaa0-edf27e7df2d1',
  archivos:'cb839e03-e29f-4649-a1ae-f527c1c266ea',
};
(async()=>{
  const [,,key,art]=process.argv;
  if(key==='LIST'){
    // buscar ley por texto
    const {data}=await s.from('laws').select('id,short_name').ilike('short_name','%'+art+'%').limit(8);
    console.log(JSON.stringify(data)); return;
  }
  const lid=L[key];
  if(!lid){ console.log('LAW_KEY_DESCONOCIDA. Claves:',Object.keys(L).join(',')); return; }
  const {data}=await s.from('articles').select('id,article_number,title,content').eq('law_id',lid).eq('article_number',String(art));
  if(!data||!data.length){ console.log('ARTICULO_NO_EN_BD law='+key+' art='+art); return; }
  const a=data[0];
  console.log('ARTICLE_ID:'+a.id);
  console.log('TITULO:'+(a.title||''));
  console.log('CONTENIDO:\n'+(a.content||'').slice(0,2200));
})();
