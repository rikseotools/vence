require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Buscar Paloma por nombre
  const { data: palomas } = await supabase
    .from("user_profiles")
    .select("id, full_name, email")
    .ilike("full_name", "%Paloma%");

  console.log("Usuarios con 'Paloma' en el nombre:");
  palomas?.forEach(p => console.log(`  ${p.id} | ${p.full_name} | ${p.email}`));

  // También buscar "Miguelanez"
  const { data: mig } = await supabase
    .from("user_profiles")
    .select("id, full_name, email")
    .ilike("full_name", "%Miguelanez%");

  console.log("\nUsuarios con 'Miguelanez' en el nombre:");
  mig?.forEach(p => console.log(`  ${p.id} | ${p.full_name} | ${p.email}`));

})();
