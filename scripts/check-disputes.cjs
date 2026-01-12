const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from("question_disputes")
    .select("id, question_id, user_id, dispute_type, description, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.log("Error:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log("No hay impugnaciones pendientes");
    return;
  }

  console.log("=== IMPUGNACIONES PENDIENTES ===");
  console.log("Total:", data.length);
  console.log("");

  data.forEach((d, i) => {
    console.log("--- Impugnación", i + 1, "---");
    console.log("ID:", d.id);
    console.log("Question ID:", d.question_id);
    console.log("Tipo:", d.dispute_type);
    console.log("Descripción:", d.description);
    console.log("Fecha:", new Date(d.created_at).toLocaleDateString("es-ES"));
    console.log("");
  });
})();
