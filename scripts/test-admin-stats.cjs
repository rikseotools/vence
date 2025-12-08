// Test admin dashboard stats RPC
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('🔍 Probando RPC get_admin_dashboard_stats...\n');

  const { data, error } = await supabase
    .rpc('get_admin_dashboard_stats');

  if (error) {
    console.log('❌ Error:', error.message);
  } else if (!data || data.length === 0) {
    console.log('⚠️ RPC no devuelve datos');
  } else {
    console.log('✅ RPC devuelve datos:');
    console.log(JSON.stringify(data[0], null, 2));
  }
})();
