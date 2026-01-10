require('dotenv').config({path:'.env.local'});
const{createClient}=require('@supabase/supabase-js');
const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);

(async()=>{
  const {data: questions} = await s.from('questions')
    .select(`
      id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation,
      primary_article_id, articles!inner(article_number, title, content, laws!inner(short_name))
    `)
    .eq('topic_review_status', 'bad_answer')
    .eq('is_active', true)
    .limit(40);
  
  console.log('Remaining bad_answer:', questions?.length || 0);
  console.log('\n');
  
  for(const q of questions || []){
    const correctOption = [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option] || '';
    const articleContent = q.articles?.content?.toLowerCase() || '';
    const correctLower = correctOption.toLowerCase();
    
    // Check if the answer keywords are in the article
    const keywords = correctLower.split(/\s+/).filter(w => w.length > 4);
    const matchingKeywords = keywords.filter(kw => articleContent.includes(kw));
    const matchRatio = keywords.length > 0 ? matchingKeywords.length / keywords.length : 0;
    
    console.log('---');
    console.log('ID:', q.id.substring(0, 8));
    console.log('Q:', q.question_text.substring(0, 100));
    console.log('Art:', q.articles?.laws?.short_name, 'art.', q.articles?.article_number);
    console.log('Resp:', ['A','B','C','D'][q.correct_option], '-', correctOption.substring(0, 70));
    console.log('Match:', (matchRatio * 100).toFixed(0) + '%', '(' + matchingKeywords.length + '/' + keywords.length + ' keywords)');
  }
})();
