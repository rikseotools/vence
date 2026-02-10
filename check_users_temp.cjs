require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, target_oposicion, email_notifications_enabled")
    .eq("email_notifications_enabled", true)
    .not("target_oposicion", "is", null);

  if (error) {
    console.log("Error:", error);
    return;
  }

  const byPosition = {};
  data.forEach(u => {
    const pos = u.target_oposicion || "sin_asignar";
    if (!byPosition[pos]) byPosition[pos] = [];
    byPosition[pos].push(u);
  });

  console.log("=== USUARIOS POR OPOSICIÓN ===\n");
  console.log("Total usuarios con notificaciones activas:", data.length);
  console.log("");

  Object.entries(byPosition).forEach(([pos, users]) => {
    console.log(pos + ": " + users.length + " usuarios");
  });

  // Mapeo de position_type a nombre legible
  const positionNames = {
    "auxiliar_administrativo": "Auxiliar Administrativo del Estado",
    "administrativo": "Administrativo del Estado",
    "tramitacion_procesal": "Tramitación Procesal",
    "auxilio_judicial": "Auxilio Judicial",
    "gestion_procesal": "Gestión Procesal"
  };

  console.log("\n=== NOMBRES PARA NEWSLETTER ===");
  Object.keys(byPosition).forEach(pos => {
    console.log(pos + " → " + (positionNames[pos] || pos));
  });
})();
