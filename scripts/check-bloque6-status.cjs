require('dotenv').config({path:'.env.local'});
const{createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);

(async()=>{
  const topics = [601, 604, 605, 606, 607, 608];
  
  for(const num of topics){
    const {data: topic} = await s.from('topics')
      .select('id')
      .eq('position_type', 'administrativo')
      .eq('topic_number', num)
      .single();
    
    if(!topic) {
      console.log('T' + num + ': not found');
      continue;
    }
    
    const {data: scopes} = await s.from('topic_scope')
      .select('law_id, article_numbers')
      .eq('topic_id', topic.id);
    
    let articleIds = [];
    for(const scope of scopes || []){
      if(!scope.law_id || !scope.article_numbers?.length) continue;
      const {data: articles} = await s.from('articles')
        .select('id')
        .eq('law_id', scope.law_id)
        .in('article_number', scope.article_numbers);
      if(articles) articleIds.push(...articles.map(a=>a.id));
    }
    
    if(articleIds.length === 0){
      console.log('T' + num + ': no articles in scope');
      continue;
    }
    
    const {data: questions} = await s.from('questions')
      .select('topic_review_status')
      .in('primary_article_id', articleIds)
      .eq('is_active', true);
    
    const statuses = {};
    questions?.forEach(q => {
      const status = q.topic_review_status || 'null';
      statuses[status] = (statuses[status] || 0) + 1;
    });
    console.log('T' + num + ' (' + (questions?.length || 0) + ' questions):', JSON.stringify(statuses));
  }
})();
