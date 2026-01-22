require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data: disputes } = await supabase.rpc('get_disputes_with_users_debug');
  if (!disputes || disputes.length === 0) {
    console.log('No hay impugnaciones');
    return;
  }
  
  const userIds = [...new Set(disputes.map(d => d.user_id).filter(Boolean))];
  console.log('User IDs en impugnaciones:', userIds.length);
  
  const { data: premiumData, error } = await supabase
    .from('user_subscriptions')
    .select('user_id, status, plan_type')
    .in('user_id', userIds);
    
  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Usuarios premium encontrados:', premiumData);
  }
})();
