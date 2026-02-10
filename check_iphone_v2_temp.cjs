require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  console.log("=== INVESTIGANDO REDIRECTS /auth/callback ===\n");

  // Primero ver todos los redirects a auth/callback de cualquier usuario
  const { data: allRedirects, error } = await supabase
    .from("user_interactions")
    .select("user_id, created_at, device_info, page_url")
    .eq("event_type", "page_view")
    .like("page_url", "%auth/callback%")
    .gte("created_at", "2026-01-20T00:00:00")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.log("Error:", error.message);
    return;
  }

  console.log(`Total redirects encontrados: ${allRedirects?.length || 0}\n`);

  if (!allRedirects || allRedirects.length === 0) {
    console.log("No se encontraron redirects. Verificando estructura de datos...\n");

    // Ver algunos registros de Bea para verificar estructura
    const bea = "25b73691-6965-4711-ba2d-41d5479430dc";
    const { data: beaSample } = await supabase
      .from("user_interactions")
      .select("page_url, event_type, created_at")
      .eq("user_id", bea)
      .limit(5);

    console.log("Muestra de datos de Bea:");
    beaSample?.forEach(s => console.log(`  ${s.event_type} | ${s.page_url}`));
    return;
  }

  // Agrupar por usuario
  const byUser = {};
  for (const r of allRedirects) {
    if (!byUser[r.user_id]) {
      byUser[r.user_id] = {
        redirects: [],
        isIOS: false
      };
    }
    byUser[r.user_id].redirects.push(r);

    // Detectar iOS
    const ua = r.device_info?.userAgent || "";
    if (ua.includes("iPhone") || ua.includes("iPad")) {
      byUser[r.user_id].isIOS = true;
    }
  }

  const iosUsers = Object.entries(byUser).filter(([_, d]) => d.isIOS);
  const nonIosUsers = Object.entries(byUser).filter(([_, d]) => !d.isIOS);

  console.log(`Usuarios iOS con redirects: ${iosUsers.length}`);
  console.log(`Usuarios no-iOS con redirects: ${nonIosUsers.length}\n`);

  // Analizar usuarios iOS
  console.log("=== USUARIOS iOS CON REDIRECTS ===\n");

  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  for (const [userId, data] of iosUsers) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single();

    const name = profile?.full_name || profile?.email?.split("@")[0] || "Anónimo";
    const isBea = userId === bea;

    // Contar redirects con poca inactividad (bug) vs normal
    let bugCount = 0;
    let normalCount = 0;

    for (const redirect of data.redirects) {
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

    const marker = isBea ? " 👈 BEA" : "";
    const ua = data.redirects[0]?.device_info?.userAgent || "";
    const iosVersion = ua.match(/OS (\d+_\d+)/)?.[1]?.replace("_", ".") || "?";

    console.log(`${name}${marker}`);
    console.log(`  Redirects totales: ${data.redirects.length}`);
    console.log(`  Bug real (<2 min): ${bugCount}`);
    console.log(`  Normal (>2 min): ${normalCount}`);
    console.log(`  iOS version: ${iosVersion}`);
    console.log("");
  }

  // Ver también usuarios no-iOS para comparar
  if (nonIosUsers.length > 0) {
    console.log("\n=== USUARIOS NO-iOS CON REDIRECTS (muestra) ===\n");

    for (const [userId, data] of nonIosUsers.slice(0, 3)) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", userId)
        .single();

      const name = profile?.full_name || "Anónimo";
      const platform = data.redirects[0]?.device_info?.platform || "Desktop";

      console.log(`${name}: ${data.redirects.length} redirects (${platform})`);
    }
  }

})();
