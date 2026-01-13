const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Buscar la conversación de venceoposiciones que está en waiting_admin
  const { data: conv } = await supabase
    .from("feedback_conversations")
    .select("id, feedback_id, status")
    .eq("status", "waiting_admin");

  console.log("Conversaciones en waiting_admin:", conv);

  // Para la conversación de vence (cf19e56a-8542-4c81-84ce-53bf9f461f2b)
  // Verificar si el último mensaje es del admin
  for (const c of conv || []) {
    const { data: lastMsg } = await supabase
      .from("feedback_messages")
      .select("is_admin, message, created_at")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    console.log("\nConv:", c.id);
    console.log("Último mensaje es admin:", lastMsg?.is_admin);
    console.log("Mensaje:", lastMsg?.message?.substring(0, 50));

    // Si el último mensaje es del admin, actualizar a waiting_user
    if (lastMsg?.is_admin) {
      const { error } = await supabase
        .from("feedback_conversations")
        .update({ status: "waiting_user" })
        .eq("id", c.id);

      if (error) {
        console.log("Error actualizando:", error);
      } else {
        console.log("✅ Actualizado a waiting_user");
      }
    }
  }
})();
