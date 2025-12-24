const fs = require('fs');
const path = require('path');

// Parse .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim();
  }
});

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Buscar leyes que parezcan virtuales
  const { data: laws, error } = await supabase
    .from('laws')
    .select('id, short_name, name, boe_url')
    .or('short_name.ilike.%inform%,name.ilike.%inform%,short_name.ilike.%virtual%,name.ilike.%virtual%,short_name.ilike.%ofim%,name.ilike.%ofim%');

  if (error) console.error('Error:', error);
  else console.log('Leyes relacionadas:', JSON.stringify(laws, null, 2));
})();
