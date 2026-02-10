require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log("=== INVESTIGANDO REDIRECTS /auth/callback EN USUARIOS IPHONE ===\n");

  // Buscar todos los redirects a /auth/callback de la última semana
  const { data: allRedirects } = await supabase
    .from("user_interactions")
    .select("user_id, created_at, device_info")
    .eq("event_type", "page_view")
    .ilike("page_url", "%/auth/callback%")
    .gte("created_at", "2026-01-20T00:00:00")
    .order("created_at", { ascending: false });

  console.log(`Total redirects a /auth/callback última semana: ${allRedirects?.length || 0}\n`);

  // Filtrar solo iPhone/iPad
  const iosRedirects = allRedirects?.filter(r => {
    const ua = r.device_info?.userAgent || "";
    return ua.includes("iPhone") || ua.includes("iPad");
  }) || [];

  console.log(`Redirects desde iOS (iPhone/iPad): ${iosRedirects.length}\n`);

  // Agrupar por usuario
  const byUser = {};
  for (const r of iosRedirects) {
    if (!byUser[r.user_id]) byUser[r.user_id] = [];
    byUser[r.user_id].push(r);
  }

  console.log(`Usuarios iOS únicos con redirects: ${Object.keys(byUser).length}\n`);

  // Para cada usuario iOS, analizar si los redirects son por inactividad o bug
  console.log("=== ANÁLISIS POR USUARIO iOS ===\n");

  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  for (const [userId, redirects] of Object.entries(byUser)) {
    // Obtener nombre del usuario
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single();

    const name = profile?.full_name || profile?.email?.split("@")[0] || "Anónimo";
    const isBea = userId === bea;

    // Analizar inactividad de cada redirect
    let bugCount = 0;
    let normalCount = 0;

    for (const redirect of redirects) {
      const redirectTime = new Date(redirect.created_at);
      const fiveMinBefore = new Date(redirectTime - 300000).toISOString();

      const { data: lastActivity } = await supabase
        .from("user_interactions")
        .select("created_at")
        .eq("user_id", userId)
        .lt("created_at", redirect.created_at)
        .gte("created_at", fiveMinBefore)
        .not("page_url", "ilike", "%/auth/callback%")
        .order("created_at", { ascending: false })
        .limit(1);

      if (lastActivity?.[0]) {
        const diffMs = redirectTime - new Date(lastActivity[0].created_at);
        const mins = diffMs / 60000;
        if (mins < 2) bugCount++;
        else normalCount++;
      } else {
        normalCount++; // Si no hay actividad reciente, asumimos que dejó parado
      }
    }

    const marker = isBea ? " 👈 BEA" : "";
    const bugPercent = redirects.length > 0 ? Math.round(bugCount / redirects.length * 100) : 0;

    if (bugCount > 0) {
      console.log(`${name}${marker}`);
      console.log(`  Total redirects: ${redirects.length}`);
      console.log(`  Bug real (<2 min): ${bugCount} (${bugPercent}%)`);
      console.log(`  Normal (>2 min): ${normalCount}`);
      console.log(`  Device: ${redirects[0].device_info?.platform || "iOS"}`);
      console.log("");
    }
  }

  // Comparar con usuarios NO iOS
  console.log("\n=== COMPARACIÓN: iOS vs OTROS DISPOSITIVOS ===\n");

  const nonIosRedirects = allRedirects?.filter(r => {
    const ua = r.device_info?.userAgent || "";
    return !ua.includes("iPhone") && !ua.includes("iPad");
  }) || [];

  console.log(`Redirects iOS: ${iosRedirects.length}`);
  console.log(`Redirects no-iOS: ${nonIosRedirects.length}`);

  // Usuarios únicos no-iOS
  const nonIosUsers = new Set(nonIosRedirects.map(r => r.user_id));
  console.log(`Usuarios únicos no-iOS con redirects: ${nonIosUsers.size}`);

})();
