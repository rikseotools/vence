require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id, question_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  console.log("Cerrando", disputes.length, "impugnaciones...\n");

  for (const d of disputes) {
    const { error } = await supabase
      .from("question_disputes")
      .update({
        status: "resolved",
        admin_response: "Tenías razón: estas preguntas no correspondían al Tema 1. Hemos corregido la asignación del tema para que solo incluya los artículos del epígrafe oficial (arts. 1-55 y 116 CE). Gracias por reportarlo.",
        resolved_at: new Date().toISOString()
      })
      .eq("id", d.id);

    if (error) {
      console.log("❌", d.id.substring(0,8), error.message);
    } else {
      console.log("✅", d.id.substring(0,8), "cerrada");
    }
  }

  // Verify
  const { count } = await supabase.from("question_disputes")
    .select("id", { count: "exact" })
    .eq("status", "pending");

  console.log("\nImpugnaciones pendientes restantes:", count);
})();
