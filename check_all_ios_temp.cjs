require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log("=== TODOS LOS REDIRECTS /auth/callback CON PLATFORM iPhone ===\n");

  // Buscar redirects donde platform sea iPhone
  const { data: iosRedirects, error } = await supabase
    .from("user_interactions")
    .select("user_id, created_at, device_info, page_url")
    .eq("event_type", "page_view")
    .like("page_url", "%auth/callback%")
    .gte("created_at", "2026-01-01T00:00:00")
    .order("created_at", { ascending: false });

  if (error) {
    console.log("Error:", error.message);
    return;
  }

  // Filtrar iOS por platform (más fiable que userAgent)
  const iosOnly = iosRedirects?.filter(r =>
    r.device_info?.platform === "iPhone" ||
    r.device_info?.platform === "iPad"
  ) || [];

  console.log(`Total redirects auth/callback (2026): ${iosRedirects?.length || 0}`);
  console.log(`Redirects desde iPhone/iPad: ${iosOnly.length}\n`);

  // Agrupar por usuario
  const byUser = {};
  for (const r of iosOnly) {
    if (!byUser[r.user_id]) byUser[r.user_id] = [];
    byUser[r.user_id].push(r);
  }

  console.log(`Usuarios iOS únicos: ${Object.keys(byUser).length}\n`);

  // Mostrar cada usuario iOS
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  for (const [userId, redirects] of Object.entries(byUser)) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single();

    const name = profile?.full_name || profile?.email?.split("@")[0] || "Anónimo";
    const isBea = userId === bea;
    const marker = isBea ? " 👈 BEA" : "";

    // Contar redirects recientes (última semana)
    const recentRedirects = redirects.filter(r =>
      new Date(r.created_at) > new Date("2026-01-20T00:00:00")
    );

    // Analizar inactividad para cada redirect reciente
    let bugCount = 0;
    let normalCount = 0;

    for (const redirect of recentRedirects) {
      const redirectTime = new Date(redirect.created_at);
      const fiveMinBefore = new Date(redirectTime - 300000).toISOString();

      const { data: lastActivity } = await supabase
        .from("user_interactions")
        .select("created_at")
        .eq("user_id", userId)
        .lt("created_at", redirect.created_at)
        .gte("created_at", fiveMinBefore)
        .not("page_url", "like", "%auth/callback%")
        .order("created_at", { ascending: false })
        .limit(1);

      if (lastActivity?.[0]) {
        const diffMs = redirectTime - new Date(lastActivity[0].created_at);
        const mins = diffMs / 60000;
        if (mins < 2) bugCount++;
        else normalCount++;
      } else {
        normalCount++;
      }
    }

    const iosVersion = redirects[0]?.device_info?.userAgent?.match(/OS (\d+_\d+)/)?.[1]?.replace("_", ".") || "?";

    console.log(`${name}${marker}`);
    console.log(`  Redirects última semana: ${recentRedirects.length}`);
    console.log(`  Bug real (<2 min): ${bugCount}`);
    console.log(`  Normal (>2 min): ${normalCount}`);
    console.log(`  iOS: ${iosVersion}`);
    console.log("");
  }

})();
