require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: leg } = await supabase.from("question_disputes").select("id, dispute_type, description, created_at").eq("status", "pending").order("created_at", { ascending: true });
  const { data: psy } = await supabase.from("psychometric_question_disputes").select("id, dispute_type, description, created_at").eq("status", "pending").order("created_at", { ascending: true });

  const { data: convs } = await supabase.from("feedback_conversations").select("id, status, feedback_messages(id, is_admin, created_at, message)").neq("status", "closed");
  let pending = [];
  if (convs) {
    for (const conv of convs) {
      const msgs = conv.feedback_messages || [];
      if (msgs.length === 0) { pending.push({ id: conv.id, reason: "sin mensajes" }); continue; }
      const sorted = msgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (sorted[0] && sorted[0].is_admin === false) {
        pending.push({ id: conv.id, reason: "usuario", msg: (sorted[0].message || "").substring(0, 120) });
      }
    }
  }

  const { data: fbNoConv } = await supabase.from("user_feedback").select("id, message, created_at, feedback_conversations(id)").in("status", ["pending", "in_progress"]);
  const sinConv = (fbNoConv || []).filter(fb => !fb.feedback_conversations || fb.feedback_conversations.length === 0);

  console.log("=== IMPUGNACIONES LEGISLATIVAS:", leg?.length || 0, "===");
  if (leg?.length) leg.forEach((d, i) => console.log("  #" + (i+1), d.dispute_type, "-", d.description, "(" + d.created_at.substring(0,10) + ")"));
  console.log("\n=== IMPUGNACIONES PSICOTÉCNICAS:", psy?.length || 0, "===");
  if (psy?.length) psy.forEach((d, i) => console.log("  #" + (i+1), d.dispute_type, "-", d.description, "(" + d.created_at.substring(0,10) + ")"));
  console.log("\n=== FEEDBACKS POR RESPONDER:", pending.length, "===");
  pending.forEach((f, i) => console.log("  #" + (i+1), f.reason, "-", f.msg || ""));
  console.log("\n=== FEEDBACKS SIN CONVERSACIÓN:", sinConv.length, "===");
  sinConv.forEach((f, i) => console.log("  #" + (i+1), (f.message || "").substring(0, 120), "(" + f.created_at.substring(0,10) + ")"));
})();
