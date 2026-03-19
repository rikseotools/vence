require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get the last (8th) dispute from Mar - ordered by created_at
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id, created_at")
    .eq("user_id", "9d2587b1-c799-476d-9797-b7a498a487b1")
    .eq("status", "resolved")
    .gte("created_at", "2026-02-23T15:00:00")
    .order("created_at", { ascending: false })
    .limit(1);

  const lastId = disputes[0].id;
  console.log("Última disputa:", lastId, disputes[0].created_at);

  const { error } = await supabase
    .from("question_disputes")
    .update({ admin_response: "Gracias Mar, hemos quitado esas preguntas del tema 1 que se nos han filtrado. Muchas gracias" })
    .eq("id", lastId);

  if (error) console.log("❌", error.message);
  else console.log("✅ Mensaje añadido");
})();
