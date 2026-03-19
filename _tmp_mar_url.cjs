require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data } = await supabase.from("user_sessions")
    .select("entry_page, referrer_url, session_start, session_end, questions_answered, questions_correct")
    .eq("id", "9f1e4aff-43bc-4080-b7ec-540ebb3de5a2")
    .single();

  console.log("Session start:", data.session_start);
  console.log("Session end:", data.session_end);
  console.log("Entry page:", data.entry_page);
  console.log("Referrer:", data.referrer_url);
  console.log("Questions:", data.questions_answered, "correct:", data.questions_correct);
  
  // Also the previous session for context
  const { data: prev } = await supabase.from("user_sessions")
    .select("entry_page, referrer_url, session_start, session_end, questions_answered")
    .eq("id", "33e521a9-7efa-4b6b-b8f5-2dfdda51db2c")
    .single();

  console.log("\nPrevious session:");
  console.log("Session start:", prev.session_start);
  console.log("Entry page:", prev.entry_page);
  console.log("Referrer:", prev.referrer_url);
})();
