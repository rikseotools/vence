require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Obtener feedbacks con status pending
  const { data: feedbacks } = await supabase
    .from("user_feedback")
    .select("id, user_id, status, message, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  console.log("Feedbacks con status pending:", feedbacks?.length || 0);

  for (const f of feedbacks || []) {
    // Ver si tiene conversación
    const { data: conv } = await supabase
      .from("feedback_conversations")
      .select("id, status")
      .eq("feedback_id", f.id)
      .single();

    // Si tiene conversación, ver último mensaje
    let lastMsgIsAdmin = null;
    if (conv) {
      const { data: msgs } = await supabase
        .from("feedback_messages")
        .select("is_admin, created_at")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (msgs && msgs.length > 0) {
        lastMsgIsAdmin = msgs[0].is_admin;
      }
    }

    const { data: u } = await supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", f.user_id)
      .single();

    const hasConv = conv !== null;
    const convNotClosed = conv && conv.status !== "closed";
    const isPending = (!hasConv && f.status === "pending") || (convNotClosed && lastMsgIsAdmin === false);

    console.log("\n---");
    console.log("Usuario:", u?.full_name || "Anon");
    console.log("Status feedback:", f.status);
    console.log("Tiene conversación:", hasConv ? "SÍ (" + conv.status + ")" : "NO");
    console.log("Último msg es admin:", lastMsgIsAdmin);
    console.log("¿Por responder?:", isPending ? "SÍ" : "NO");
    console.log("Mensaje:", f.message?.substring(0, 60));
  }
})();
