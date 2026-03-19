require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data: feedbacks } = await supabase
    .from("user_feedback")
    .select("*")
    .order("created_at", { ascending: true });

  let count = 0;
  for (const f of (feedbacks || [])) {
    const { data: conv } = await supabase
      .from("feedback_conversations")
      .select("id, status")
      .eq("feedback_id", f.id)
      .single();

    let messages = [];
    if (conv) {
      const { data: msgs } = await supabase
        .from("feedback_messages")
        .select("is_admin, message, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });
      messages = msgs || [];
    }

    // Sin conversación, o último mensaje es del usuario (sin respuesta admin)
    const sinRespuesta = !conv || messages.length === 0 ||
      (messages.length > 0 && messages[messages.length - 1].is_admin === false);

    if (sinRespuesta) {
      count++;
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name, email, plan_type, target_oposicion")
        .eq("id", f.user_id)
        .single();

      console.log("========================================");
      console.log("Feedback ID:", f.id);
      console.log("Status:", f.status);
      console.log("Usuario:", (profile && profile.full_name) || "?", "<" + ((profile && profile.email) || "?") + ">");
      console.log("Plan:", profile && profile.plan_type);
      console.log("Oposición:", profile && profile.target_oposicion);
      console.log("Fecha:", f.created_at);
      console.log("Mensaje:", f.message);
      console.log("URL:", f.page_url || "N/A");
      if (messages.length > 0) {
        console.log("--- Mensajes ---");
        for (const m of messages) {
          const quien = m.is_admin ? "ADMIN" : "USUARIO";
          console.log("  [" + quien + "] " + m.created_at + ": " + m.message);
        }
      } else {
        console.log("Sin conversación ni mensajes");
      }
      console.log();
    }
  }

  if (count === 0) {
    console.log("No hay feedbacks sin responder.");
  } else {
    console.log("Total sin responder:", count);
  }
})();
