const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Ver el feedback específico
  const { data: feedback } = await supabase
    .from("user_feedback")
    .select("*")
    .eq("id", "45c07491-0d81-4b33-bdae-869d21565ce2")
    .single();

  console.log("=== FEEDBACK CON WAITING_ADMIN ===");
  console.log(feedback);

  // Ver mensajes de la conversación
  const { data: messages } = await supabase
    .from("feedback_messages")
    .select("*")
    .eq("conversation_id", "6bb7e8cb-04ff-492c-b2f9-a1af56995f02")
    .order("created_at", { ascending: false })
    .limit(3);

  console.log("\n=== ÚLTIMOS MENSAJES ===");
  messages?.forEach(m => {
    console.log("Sender:", m.sender_type, "| Mensaje:", m.message?.substring(0, 50));
  });
})();
