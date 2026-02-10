require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  // TODAS las interacciones de Bea sin filtro
  console.log("=== TODAS LAS INTERACCIONES DE BEA ===\n");
  const { data: allInteractions } = await supabase
    .from("user_interactions")
    .select("*")
    .eq("user_id", bea)
    .order("created_at", { ascending: false })
    .limit(50);

  if (allInteractions && allInteractions.length > 0) {
    console.log(`Total: ${allInteractions.length} interacciones\n`);

    // Agrupar por día
    const byDay = {};
    allInteractions.forEach(i => {
      const day = i.created_at.split("T")[0];
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(i);
    });

    Object.keys(byDay).sort().reverse().forEach(day => {
      console.log(`\n📅 ${day} (${byDay[day].length} interacciones):`);
      byDay[day].forEach(i => {
        const time = i.created_at.split("T")[1].split(".")[0];
        console.log(`  ${time} | ${i.interaction_type} | ${i.page_path}`);
        if (i.metadata) {
          const meta = typeof i.metadata === "string" ? JSON.parse(i.metadata) : i.metadata;
          if (meta.error || meta.reason || meta.session) {
            console.log(`    ↳ ${JSON.stringify(meta)}`);
          }
        }
      });
    });
  } else {
    console.log("No hay interacciones registradas");
  }

  // Buscar su perfil
  console.log("\n\n=== PERFIL DE BEA ===\n");
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", bea)
    .single();

  if (profile) {
    console.log("Email:", profile.email);
    console.log("Nombre:", profile.full_name);
    console.log("Creado:", profile.created_at);
    console.log("Última actividad:", profile.last_activity_at);
    console.log("Plan:", profile.subscription_tier);
    console.log("Dispositivo:", profile.device_type);
    console.log("Browser:", profile.browser);
    console.log("OS:", profile.os);
  }

  // Buscar en auth.users si es posible
  console.log("\n\n=== INFO AUTH ===\n");
  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(bea);

  if (authUser && authUser.user) {
    const u = authUser.user;
    console.log("Email confirmado:", u.email_confirmed_at ? "SÍ" : "NO");
    console.log("Último sign in:", u.last_sign_in_at);
    console.log("Identities:", u.identities?.length || 0);
    console.log("App metadata:", JSON.stringify(u.app_metadata));
    console.log("Confirmado:", u.confirmed_at);
  } else if (authErr) {
    console.log("Error auth:", authErr.message);
  }

  // Ver si hay sesiones activas
  console.log("\n\n=== SESIONES AUTH ===");
  // No podemos ver sesiones directamente, pero podemos ver factors

})();
