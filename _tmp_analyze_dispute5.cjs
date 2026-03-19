require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const qId = "53183b91-fce7-4841-805c-00a04a0ae281";
  
  // Minimal query - just id and text
  const { data: q, error } = await supabase
    .from("questions")
    .select("id, question_text")
    .eq("id", qId);

  console.log("Error:", error?.message);
  console.log("Results:", q?.length);
  if (q && q[0]) console.log("Texto:", q[0].question_text.substring(0, 100));
  
  // Try wildcard select for first question
  const { data: q2, error: e2 } = await supabase
    .from("questions")
    .select("*")
    .eq("id", qId)
    .single();

  if (e2) console.log("Error *:", e2.message);
  if (q2) {
    console.log("\nColumnas disponibles:", Object.keys(q2).join(", "));
    console.log("\nDatos clave:");
    console.log("question_text:", q2.question_text?.substring(0, 120));
    console.log("option_a:", q2.option_a);
    console.log("option_b:", q2.option_b);  
    console.log("option_c:", q2.option_c);
    console.log("option_d:", q2.option_d);
    console.log("correct_option:", q2.correct_option);
    // Print all columns that might indicate topic/theme
    for (const [k, v] of Object.entries(q2)) {
      if (k.includes("topic") || k.includes("theme") || k.includes("subject") || k.includes("scope") || k.includes("category") || k.includes("law") || k.includes("article")) {
        console.log(`${k}:`, v);
      }
    }
  }
})();
