require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const ids = [
    "dbc540e3-37b3-436f-b5dc-ad38fdc5de64",
    "54860d47-c5f3-4f3e-b7c1-1234567890ab",
    "bdbbe406-1234-5678-abcd-1234567890ab",
    "85e53b0d-1234-5678-abcd-1234567890ab",
    "6831c446-1234-5678-abcd-1234567890ab",
    "98660e42-1234-5678-abcd-1234567890ab",
    "dfd47f24-1234-5678-abcd-1234567890ab",
    "50d90ee2-1234-5678-abcd-1234567890ab"
  ];

  // Get actual IDs from resolved disputes for Mar
  const { data: disputes } = await supabase
    .from("question_disputes")
    .select("id")
    .eq("user_id", "9d2587b1-c799-476d-9797-b7a498a487b1")
    .eq("status", "resolved")
    .not("admin_response", "is", null)
    .gte("created_at", "2026-02-23T15:00:00");

  console.log("Disputas con admin_response:", disputes?.length);

  for (const d of disputes) {
    const { error } = await supabase
      .from("question_disputes")
      .update({ admin_response: null })
      .eq("id", d.id);

    if (error) console.log("❌", d.id.substring(0,8), error.message);
    else console.log("✅", d.id.substring(0,8), "admin_response eliminado");
  }
})();
