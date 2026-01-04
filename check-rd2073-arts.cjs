const fs = require("fs");
fs.readFileSync("/home/manuel/Documentos/github/vence/.env.local", "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: law } = await supabase.from("laws").select("id").eq("short_name", "RD 2073/1999").single();
  const { data: articles } = await supabase.from("articles")
    .select("article_number, title")
    .eq("law_id", law.id)
    .order("article_number");

  console.log("=== ARTÍCULOS RD 2073/1999 EN BD ===");
  const nums = [];
  for (const a of articles) {
    nums.push(a.article_number);
    console.log(a.article_number + ": " + a.title);
  }

  // Mencionados en preguntas según grep
  const mentioned = ["1", "2", "3", "4", "5", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "37"];
  const missing = mentioned.filter(n => nums.indexOf(n) === -1);
  console.log("\n=== FALTANTES ===");
  console.log(missing.join(", ") || "Ninguno");

  // Verificar RD 1405/1986
  const { data: law1405 } = await supabase.from("laws").select("id").eq("short_name", "RD 1405/1986").single();
  if (law1405) {
    const { data: arts1405 } = await supabase.from("articles")
      .select("article_number, title")
      .eq("law_id", law1405.id);
    console.log("\n=== RD 1405/1986 EN BD ===");
    arts1405.forEach(a => console.log(a.article_number + ": " + a.title));
  } else {
    console.log("\n=== RD 1405/1986 NO EXISTE EN BD ===");
  }
})();
