require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Buscar feedbacks de Iván y Bea
  const ivan = "524811a5-324d-4b75-987c-a454e00f3f7f";
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";

  for (const userId of [ivan, bea]) {
    const { data: feedbacks } = await supabase
      .from("user_feedback")
      .select("id, status, message")
      .eq("user_id", userId);

    const { data: u } = await supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", userId)
      .single();

    console.log("\n=== " + u?.full_name + " ===");

    for (const f of feedbacks || []) {
      const { data: conv } = await supabase
        .from("feedback_conversations")
        .select("id, status")
        .eq("feedback_id", f.id)
        .single();

      let lastMsg = null;
      if (conv) {
        const { data: msgs } = await supabase
          .from("feedback_messages")
          .select("is_admin, message, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: false })
          .limit(1);
        lastMsg = msgs?.[0];
      }

      const convNotClosed = conv && conv.status !== "closed";
      const isPending = convNotClosed && lastMsg && lastMsg.is_admin === false;

      console.log("Status:", f.status, "| Conv:", conv?.status || "ninguna");
      console.log("Último msg admin?:", lastMsg?.is_admin);
      console.log("¿Por responder?:", isPending ? "SÍ" : "NO");
      console.log("Mensaje usuario:", f.message?.substring(0, 50));
      if (lastMsg) console.log("Último msg:", lastMsg.message?.substring(0, 50));
      console.log("---");
    }
  }
})();
