require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const topicId = 'c42058be-bf18-4a83-8b40-56fa6358aa41';

  const { data: topicScopes } = await supabase
    .from('topic_scope')
    .select('id, article_numbers, law_id')
    .eq('topic_id', topicId);

  let allArticleIds = [];
  for (const scope of topicScopes || []) {
    if (!scope.law_id || !scope.article_numbers?.length) continue;
    const { data: articles } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', scope.law_id)
      .in('article_number', scope.article_numbers);
    if (articles) {
      allArticleIds.push(...articles.map(a => a.id));
    }
  }

  const { data: questions } = await supabase
    .from('questions')
    .select('id, topic_review_status')
    .in('primary_article_id', allArticleIds)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  console.log(`Total preguntas activas del tema: ${questions.length}`);

  const statusCounts = {};
  questions.forEach(q => {
    const status = q.topic_review_status || 'null';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('\nDesglose por estado:');
  Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  const withErrors = questions.filter(q =>
    !q.topic_review_status ||
    !['perfect', 'tech_perfect'].includes(q.topic_review_status)
  );

  console.log(`\nCon errores o sin verificar: ${withErrors.length}`);

  const { data: verified } = await supabase
    .from('ai_verification_results')
    .select('question_id')
    .gte('verified_at', '2026-01-21');

  const verifiedIds = new Set(verified?.map(v => v.question_id) || []);
  console.log(`Verificadas desde 2026-01-21: ${verifiedIds.size}`);

  const remaining = withErrors.filter(q => !verifiedIds.has(q.id));
  console.log(`Quedan por verificar: ${remaining.length}`);

  // Verificar cuántas de las 91 procesadas están en verified
  const batch0 = '7ee9b795-3416-416d-aaa5-700456b8f3e7,e2522900-4c4d-4610-a253-72b46f653c92,b87594f3-0da5-4322-b8e5-39282379974d,e472a625-6888-42fd-8e73-20dac57435be,4e35313b-89e2-4534-9eb1-0e02ccbd7ff2,7ee60207-d0b1-46dd-b293-9252f61aeadc,73512060-3527-495d-b133-21b601751058,517f353e-14eb-45e5-a33c-3dbb3392c2aa,b7a383e6-db60-42a5-b953-c2a8ce868946,13e6b204-1d40-46f7-993d-0aa396878a4f,9ffb8a00-9f23-4b52-a219-bfb12a2b9eee,7b6557c6-3eab-4daf-8f7e-5551974a42f4,26b64f59-1053-4c1b-b3cb-3b6b34984295,fdda0a90-bdb8-4113-8187-3d868674b93d,72604863-46e6-45b2-ba87-b11ffbf71095,f7cf1ce2-6db1-4a51-a614-c5f5ef6ba376,b959a3e6-3549-4235-9e12-0c468400686e,fc9ecaae-bcea-40d6-b053-e76952b6599b,2abfa410-95cd-4af2-9479-536bd3773204,df433fe4-ee72-49c9-bd29-59ca4f467c6a,1bee9b7f-e258-46e5-99a0-805153ed0358,5febd5a0-91e7-4878-b6d8-f1222def174f,64d40a43-a681-4964-8155-78f3154061e6,86f33a3b-2408-449a-bb07-e70c5ce4e0b0,b9ae23e3-17d3-47b4-85f5-3d2012c54a63,9954e535-b085-4048-8668-0ffbf6e54924,a71f412a-5430-43ea-8532-c9b22121a405,0465c4dc-49eb-4fa2-84b0-40b00ff0a42f,c3c56134-69ac-43f6-88b7-56823a89156d,fa4d41d8-2c78-424c-ab6d-6e2617be687f,32d3d34a-6276-4a01-800a-6ddd1c034fbb,07144c87-2bb8-44d1-9b13-aeda7a153e0a,7fbca3a0-8717-4ef7-bce2-6f51e8f9edde,25fdffde-22ac-4a7b-bcca-13e56966eeff,203a682c-cc64-463a-8822-cb4bef940f70,fe67c5a5-4101-4177-930b-dc96efe6c403,4158718c-94a6-4c44-bbc4-5b07075abef2,9796045f-9124-43bb-8060-56e148302511,14de3c1c-b01d-4729-91ec-67f70b27b6d7,9c7001ac-f1c8-4cf5-9d28-45c493387532,4fca6ff8-8be0-4b03-bbac-0771726afffa,5a9bce63-3106-4b2e-be4c-1eac3783fe34,35043465-d0b9-43c5-9213-559327aa5c92,6797631c-5f66-4956-b360-31a4df788558,8f141826-5a85-4649-b0e4-74565b7cf904,3f81653e-64b4-4ed7-90fc-83f1fdf92c85,b359193a-df53-4c78-96a9-a70e57096f26,0dd5ed37-9b76-4ef9-aa13-0afb37800d43,581eafcb-8098-4ebf-bf4a-8cff844d82dc,d6021615-7332-435c-a98d-8c1e41825e2a'.split(',');

  const batch1 = '63674223-7e64-409c-9481-9c3b4db7e7a3,b7307d13-d7bf-4b72-9b90-3acfb23e0018,a2f89c67-f10c-41bc-a856-392d3732d98a,2e9547a8-d285-44eb-8640-79c9fdd17e53,f4618938-27c1-4388-bdea-195b11b695d9,37829fdb-bdd9-4030-9126-3dadb733f8ad,ce2b1acc-2e63-4064-86f6-ae131a0cb725,07e22f6a-7863-46b6-a5b2-d605d72e3770,5a731471-5999-42fc-afaf-1bf1f9c48dd4,479671ea-452a-4dac-8246-1fa42c65dc0a,ce5ad92a-e0d5-403c-9d54-c3b205eda7b8,b9247a6d-9067-4925-acab-6d870c387ade,1b0baa01-5800-4da1-ac83-cb4669eb4c2c,e8d368e4-fce0-41d0-ad9b-f07ce716c42f,bcb2f9be-84df-4946-9889-879e29d7f5cd,86ec20fb-a004-4b28-aae5-4783e9d2a109,8fb5ea4b-6d58-4c19-b090-9158a59f7075,af0aedca-1b4b-4302-8106-2bd912f97b6a,2db79b93-0313-4f2d-9447-b58dc373d2d2,57969daa-6822-4a9a-b697-e0ab189a1dd6,64932671-8968-42f3-8563-adee4e75e804,954b14c9-ea4d-4836-97ee-15ecc52d39f5,2f9ab59f-3fc1-4a2a-b00b-d2a925b3ae9a,e312617e-ac8b-4d09-aacb-70856b871d4a,d2c74049-6b47-4037-a1df-738371d079be,c3fea377-7ab9-4e45-bc44-93b78308473e,4c6272d1-9efe-4429-84bd-5d2f931d075c,1cb5cb8f-23fe-4f9f-9fc3-9db6e5bdbf19,742fc821-e686-401c-b241-068cdcfa085d,f87cb2e1-5964-4dc8-a509-d4fb3a790821,44a3577d-9d65-4d9f-9cd4-9021643dfc7e,a970db9f-1462-4f61-aa69-c32336da08d4,3ca2b24e-ef6e-4598-97d2-2d606ed288aa,5c8333f7-4adf-46b9-8949-13e133aa60f4,396e11f2-e256-4e52-af95-ad641ace8afc,6976e1b2-a24b-4293-8724-47929b0a7ef2,a82a0621-58ee-432e-a941-2f7d324a6520,61a80c12-2f32-4f12-ab80-035501371520,acd1dc06-237b-48bd-869a-bf8a6822cb53,3a4c8f24-3502-4ecb-a234-ad241d6714d3,e46acb7e-43a8-4e70-aeed-8035e4872733'.split(',');

  const allProcessed = [...batch0, ...batch1];
  const processedVerified = allProcessed.filter(id => verifiedIds.has(id));

  console.log(`\n=== Verificación de las 91 preguntas procesadas ===`);
  console.log(`Total que deberían estar verificadas: 91`);
  console.log(`Encontradas en ai_verification_results: ${processedVerified.length}`);

  if (processedVerified.length < 91) {
    console.log(`\n❌ FALTAN ${91 - processedVerified.length} preguntas por guardar en ai_verification_results`);
  } else {
    console.log(`\n✅ Todas las 91 preguntas están guardadas en ai_verification_results`);
  }
})();
