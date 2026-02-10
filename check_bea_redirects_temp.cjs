require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";
  const fixDate = "2026-01-23T06:06:06";

  console.log("=== TODOS LOS REDIRECTS A /auth/callback DE BEA ===\n");

  const { data: allAuth } = await supabase
    .from("user_interactions")
    .select("created_at, page_url")
    .eq("user_id", bea)
    .eq("event_type", "page_view")
    .ilike("page_url", "%/auth/callback%")
    .order("created_at", { ascending: true });

  if (allAuth) {
    console.log("ANTES del fix (23 enero 06:06):\n");
    allAuth.filter(a => a.created_at < fixDate).forEach(a => {
      console.log(`  ${a.created_at}`);
    });

    console.log("\n\nDESPUÉS del fix:\n");
    allAuth.filter(a => a.created_at >= fixDate).forEach(a => {
      console.log(`  ${a.created_at}`);
    });
  }

  // Ver si los redirects post-fix interrumpieron tests o fueron login normal
  console.log("\n\n=== CONTEXTO DE CADA REDIRECT POST-FIX ===\n");

  const postFixRedirects = allAuth?.filter(a => a.created_at >= fixDate) || [];

  for (const redirect of postFixRedirects) {
    const time = new Date(redirect.created_at);
    const before = new Date(time - 60000).toISOString(); // 1 min antes
    const after = new Date(time.getTime() + 60000).toISOString(); // 1 min después

    const { data: context } = await supabase
      .from("user_interactions")
      .select("created_at, event_type, page_url, label")
      .eq("user_id", bea)
      .gte("created_at", before)
      .lte("created_at", after)
      .order("created_at", { ascending: true });

    console.log(`--- ${redirect.created_at.split("T")[0]} ${redirect.created_at.split("T")[1].split(".")[0]} ---`);

    if (context) {
      context.forEach(c => {
        const t = c.created_at.split("T")[1].split(".")[0];
        const isCallback = c.page_url?.includes("/auth/callback");
        const marker = isCallback ? ">>> " : "    ";
        console.log(`${marker}${t} | ${c.event_type} | ${c.page_url || c.label || ""}`);
      });
    }
    console.log("");
  }

})();
