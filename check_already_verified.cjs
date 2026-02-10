require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ids = '13d9573a-41bf-45db-b599-24c7716ab8cb,33ad0d2d-daf5-49c6-a324-fe531e3f0127,d9165445-b880-4035-bdc6-b651c2675336,567965ce-1a69-4a0b-a13a-e09a1065d7ec,279f019e-edef-41a5-859d-979bee15cd62,e328f8ee-e8d9-41e7-b80c-456e42962d72,d27ebf50-6040-401f-b86e-8f3544657441,387fe06d-2888-4eff-8b29-b6262f045ce2,649e3bde-71d8-4260-b6cd-1876f0ca601d,508a950d-4da5-40ad-94d1-c70ce162584a,d353e414-6773-40d0-adde-d9065ece7937,61d452bf-418f-4409-9602-31b6941031e8,15c5a257-616e-4c22-8839-974be70c2630,c36f20ba-1b22-4004-b495-93d2280ea969,e7e48d69-8485-44be-8624-cfb533cd5995,0497f13a-f495-4ee3-a188-2a93626e03d1,d159aec2-22e6-403d-ae6c-636ac8d9735c,9a8b99c5-c1a2-4e10-9c19-ad66422f7287,1ea32b01-225f-4fec-96d8-3d4602de383c,58f5b664-7c01-4e81-b70b-d7d11d6b9b18,f519006a-3f71-4dc5-b7bf-4c93c8f2b24b,b808676f-1d24-47aa-a44f-fb62351bdc40,f9ac2200-b55f-466d-abc6-2266188ab27c,ae73eee1-7fa8-4e87-9d2e-8b0ca3b87709,f2c203d4-06fb-430b-8f3b-61c469e4f2fb,ccc00f8c-7c79-40b0-b223-90d6ab5e52de,faf16271-81e8-49a5-8f4a-b7560d68a232,06e86010-2efd-4e8d-9a63-9fd8f89430dc,e3dbd865-35a4-4f81-91f8-0c95852ab713,0ddb6d5a-0a8f-4b8f-9137-9255c9eeb7df,a977b403-db60-483f-8e63-3fa65940b81e,d7b8cb98-03be-4561-9a3f-98011844268a'.split(',');

(async () => {
  const { data: verified } = await supabase
    .from('ai_verification_results')
    .select('question_id')
    .in('question_id', ids)
    .gte('verified_at', '2026-01-21');

  const verifiedIds = new Set(verified?.map(v => v.question_id) || []);

  console.log(`Total IDs a verificar: ${ids.length}`);
  console.log(`Ya verificadas en BD: ${verifiedIds.size}`);
  console.log(`Faltan por verificar: ${ids.length - verifiedIds.size}`);

  const missing = ids.filter(id => !verifiedIds.has(id));

  if (missing.length > 0) {
    console.log('\nIDs que faltan por verificar:');
    console.log(missing.join(','));
  } else {
    console.log('\n✅ Todas las preguntas ya están verificadas en BD');
  }
})();
