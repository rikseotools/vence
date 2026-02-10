require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  // Ver redirects de Bea con device_info
  const { data } = await supabase
    .from("user_interactions")
    .select("created_at, page_url, device_info")
    .eq("user_id", bea)
    .like("page_url", "%auth/callback%")
    .order("created_at", { ascending: false })
    .limit(5);

  console.log("Redirects de Bea:\n");

  data?.forEach(d => {
    console.log(`${d.created_at}`);
    console.log(`  URL: ${d.page_url}`);
    console.log(`  Platform: ${d.device_info?.platform}`);
    console.log(`  UserAgent: ${d.device_info?.userAgent?.substring(0, 80)}...`);
    console.log("");
  });

  // Verificar si Bea está en los 100 redirects
  const { data: allRedirects } = await supabase
    .from("user_interactions")
    .select("user_id")
    .eq("event_type", "page_view")
    .like("page_url", "%auth/callback%")
    .eq("user_id", bea)
    .gte("created_at", "2026-01-20T00:00:00");

  console.log(`\nRedirects de Bea desde 20 enero: ${allRedirects?.length || 0}`);

})();
