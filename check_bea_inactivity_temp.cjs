require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  console.log("=== ANÁLISIS DE INACTIVIDAD ANTES DE CADA REDIRECT ===\n");

  // Obtener todos los redirects post-fix
  const { data: redirects } = await supabase
    .from("user_interactions")
    .select("created_at")
    .eq("user_id", bea)
    .eq("event_type", "page_view")
    .ilike("page_url", "%/auth/callback%")
    .gte("created_at", "2026-01-23T06:06:06")
    .order("created_at", { ascending: true });

  for (const redirect of redirects || []) {
    const redirectTime = new Date(redirect.created_at);

    // Buscar la última actividad ANTES del redirect (hasta 1 hora antes)
    const oneHourBefore = new Date(redirectTime - 3600000).toISOString();

    const { data: beforeActivity } = await supabase
      .from("user_interactions")
      .select("created_at, event_type, page_url")
      .eq("user_id", bea)
      .lt("created_at", redirect.created_at)
      .gte("created_at", oneHourBefore)
      .not("page_url", "ilike", "%/auth/callback%")
      .order("created_at", { ascending: false })
      .limit(1);

    const lastActivity = beforeActivity?.[0];

    let inactivityMinutes = "N/A";
    if (lastActivity) {
      const lastTime = new Date(lastActivity.created_at);
      const diffMs = redirectTime - lastTime;
      inactivityMinutes = (diffMs / 60000).toFixed(1);
    }

    const date = redirect.created_at.split("T")[0];
    const time = redirect.created_at.split("T")[1].split(".")[0];

    console.log(`--- ${date} ${time} ---`);
    console.log(`Última actividad: ${lastActivity?.created_at?.split("T")[1]?.split(".")[0] || "N/A"}`);
    console.log(`Página anterior: ${lastActivity?.page_url || "N/A"}`);
    console.log(`⏱️  INACTIVIDAD: ${inactivityMinutes} minutos`);

    if (parseFloat(inactivityMinutes) < 2) {
      console.log(`⚠️  MUY POCO TIEMPO - Posible bug real`);
    } else if (parseFloat(inactivityMinutes) > 5) {
      console.log(`✅ Dejó el test parado - Comportamiento normal`);
    }
    console.log("");
  }

  // Resumen
  console.log("\n=== RESUMEN ===\n");

  let bugReal = 0;
  let dejadoParado = 0;

  for (const redirect of redirects || []) {
    const redirectTime = new Date(redirect.created_at);
    const oneHourBefore = new Date(redirectTime - 3600000).toISOString();

    const { data: beforeActivity } = await supabase
      .from("user_interactions")
      .select("created_at")
      .eq("user_id", bea)
      .lt("created_at", redirect.created_at)
      .gte("created_at", oneHourBefore)
      .not("page_url", "ilike", "%/auth/callback%")
      .order("created_at", { ascending: false })
      .limit(1);

    if (beforeActivity?.[0]) {
      const diffMs = redirectTime - new Date(beforeActivity[0].created_at);
      const mins = diffMs / 60000;

      if (mins < 2) bugReal++;
      else dejadoParado++;
    }
  }

  console.log(`Redirects por dejar test parado (>2 min inactividad): ${dejadoParado}`);
  console.log(`Redirects que parecen bug real (<2 min inactividad): ${bugReal}`);

})();
