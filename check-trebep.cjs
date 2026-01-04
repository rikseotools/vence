const fs = require("fs");
fs.readFileSync("/home/manuel/Documentos/github/vence/.env.local", "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Check RD 2073/1999
  const { data: law2073 } = await supabase.from("laws").select("id").eq("short_name", "RD 2073/1999").single();
  if (law2073) {
    const { data: articles } = await supabase.from("articles").select("article_number").eq("law_id", law2073.id);
    const arts = articles ? articles.map(a => a.article_number).sort((a,b) => parseInt(a) - parseInt(b)) : [];
    console.log("=== RD 2073/1999 ===");
    console.log("Artículos existentes:", arts.join(", ") || "(ninguno)");
    console.log("Mencionados en preguntas: 1, 3, 5, 11, 12, 13, 14, 15");
    const mencionados = ["1", "3", "5", "11", "12", "13", "14", "15"];
    const faltantes = mencionados.filter(a => !arts.includes(a));
    console.log("Faltantes:", faltantes.join(", ") || "(ninguno)");
  } else {
    console.log("RD 2073/1999 no encontrado");
  }
})();
