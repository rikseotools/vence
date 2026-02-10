require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  // Ver estructura completa de algunas interacciones
  console.log("=== ESTRUCTURA RAW DE INTERACCIONES ===\n");
  const { data: raw } = await supabase
    .from("user_interactions")
    .select("*")
    .eq("user_id", bea)
    .order("created_at", { ascending: false })
    .limit(5);

  if (raw) {
    raw.forEach((r, i) => {
      console.log(`\n--- Registro ${i + 1} ---`);
      console.log(JSON.stringify(r, null, 2));
    });
  }

  // Buscar en la columna correcta - puede ser event_type o action
  console.log("\n\n=== COLUMNAS DE LA TABLA ===\n");
  const { data: sample } = await supabase
    .from("user_interactions")
    .select("*")
    .limit(1);

  if (sample && sample[0]) {
    console.log("Columnas:", Object.keys(sample[0]));
  }

  // Ver si hay otra tabla con el historial de navegación
  console.log("\n\n=== BUSCANDO OTRAS TABLAS ===\n");
  const possibleTables = [
    "page_views",
    "user_activity",
    "session_history",
    "navigation_history",
    "user_sessions"
  ];

  for (const t of possibleTables) {
    const { data, error } = await supabase.from(t).select("*").limit(1);
    if (!error) {
      console.log(`✅ Tabla ${t} existe`);
      if (data && data[0]) console.log("  Columnas:", Object.keys(data[0]));
    }
  }

  // Intentar buscar en user_interactions con diferentes filtros
  console.log("\n\n=== INTERACCIONES CON PAGE_PATH NO NULL ===\n");
  const { data: withPath } = await supabase
    .from("user_interactions")
    .select("*")
    .eq("user_id", bea)
    .not("page_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (withPath && withPath.length > 0) {
    console.log(`${withPath.length} con page_path:`);
    withPath.forEach(w => {
      console.log(`  ${w.created_at.split("T")[1].split(".")[0]} | ${w.page_path}`);
    });
  } else {
    console.log("Ninguna tiene page_path");
  }

})();
