require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Feedbacks pendientes
  const { data: feedbacks } = await supabase
    .from("user_feedback")
    .select("*")
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: true });

  for (const f of (feedbacks || [])) {
    // Perfil del usuario
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, email, plan_type, created_at, target_oposicion")
      .eq("id", f.user_id)
      .single();

    // Conversación asociada
    const { data: conv } = await supabase
      .from("feedback_conversations")
      .select("id, status, last_message_at")
      .eq("feedback_id", f.id)
      .single();

    // Mensajes de la conversación
    let messages = [];
    if (conv) {
      const { data: msgs } = await supabase
        .from("feedback_messages")
        .select("sender_id, is_admin, message, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });
      messages = msgs || [];
    }

    console.log("========================================");
    console.log("Feedback ID:", f.id);
    console.log("Usuario:", profile?.full_name || "?", "<" + (profile?.email || "?") + ">");
    console.log("Plan:", profile?.plan_type);
    console.log("Oposición:", profile?.target_oposicion);
    console.log("Registrado:", profile?.created_at);
    console.log("Fecha feedback:", f.created_at);
    console.log("Status:", f.status);
    console.log("Mensaje:", f.message);
    console.log("URL:", f.page_url || "N/A");
    console.log("User Agent:", f.user_agent ? f.user_agent.substring(0, 100) : "N/A");
    console.log("Conversación:", conv ? conv.status : "Sin conversación");

    if (messages.length > 0) {
      console.log("\n--- Mensajes ---");
      for (const m of messages) {
        const quien = m.is_admin ? "ADMIN" : "USUARIO";
        console.log(`  [${quien}] ${m.created_at}: ${m.message}`);
      }
    }
    console.log();
  }
})();
