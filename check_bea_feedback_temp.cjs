require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  // Ver todos los feedbacks de Bea
  const { data: feedbacks } = await supabase
    .from("user_feedback")
    .select("id, message, status, created_at")
    .eq("user_id", bea)
    .order("created_at", { ascending: true });

  console.log("=== FEEDBACKS DE BEA ===\n");

  for (const f of feedbacks || []) {
    console.log(`--- ${f.created_at} (${f.status}) ---`);
    console.log(f.message);
    console.log("");

    // Ver conversación si existe
    const { data: conv } = await supabase
      .from("feedback_conversations")
      .select("id, status")
      .eq("feedback_id", f.id)
      .single();

    if (conv) {
      const { data: messages } = await supabase
        .from("feedback_messages")
        .select("is_admin, message, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });

      if (messages && messages.length > 0) {
        console.log("CONVERSACIÓN:");
        for (const m of messages) {
          const who = m.is_admin ? "ADMIN" : "BEA";
          console.log(`  [${who}] ${m.created_at?.split("T")[0]}: ${m.message}`);
        }
        console.log("");
      }
    }
  }
})();
