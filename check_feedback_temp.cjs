require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Buscar usuarios Iván y Bea
  const { data: ivan } = await supabase
    .from("user_profiles")
    .select("id")
    .ilike("email", "%rrssempi123%")
    .single();

  const { data: bea } = await supabase
    .from("user_profiles")
    .select("id")
    .ilike("email", "%begmol323%")
    .single();

  console.log("Iván ID:", ivan?.id);
  console.log("Bea ID:", bea?.id);

  // Buscar feedbacks de estos usuarios en user_feedback
  if (ivan?.id) {
    const { data: fIvan } = await supabase
      .from("user_feedback")
      .select("id, message, status, created_at")
      .eq("user_id", ivan.id);
    console.log("\nFeedbacks de Iván en user_feedback:", fIvan?.length || 0);
    if (fIvan) fIvan.forEach(f => console.log("  -", f.status, f.message?.substring(0,50)));
  }

  if (bea?.id) {
    const { data: fBea } = await supabase
      .from("user_feedback")
      .select("id, message, status, created_at")
      .eq("user_id", bea.id);
    console.log("\nFeedbacks de Bea en user_feedback:", fBea?.length || 0);
    if (fBea) fBea.forEach(f => console.log("  -", f.status, f.message?.substring(0,50)));
  }

  // Buscar si hay tabla feedback_conversations
  const { data: convs, error: errConv } = await supabase
    .from("feedback_conversations")
    .select("*")
    .limit(5);

  if (errConv) {
    console.log("\n❌ feedback_conversations no existe o error:", errConv.message);
  } else {
    console.log("\n✅ Tabla feedback_conversations existe");
    console.log("Registros:", convs?.length);
    if (convs?.[0]) console.log("Columnas:", Object.keys(convs[0]));
  }

  // Buscar si hay tabla support_tickets o similar
  const tables = ["support_tickets", "support_conversations", "chat_messages", "admin_messages"];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("*").limit(1);
    if (!error) {
      console.log("\n✅ Tabla", t, "existe");
    }
  }
})();
