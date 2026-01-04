const fs = require("fs");
const path = require("path");
fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n").forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
});
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function spanishTextToNumber(text) {
  if (!text) return null;
  text = text.replace(/\.+$/, '').trim();

  const suffixMatch = text.match(/^(.+?)\s+(bis|ter|quater|quinquies|sexies|septies)\.?$/i);
  let mainText = suffixMatch ? suffixMatch[1].trim() : text.trim();
  const suffix = suffixMatch ? suffixMatch[2].toLowerCase() : '';
  const normalized = mainText.toLowerCase().trim();

  const ordinals = { 'primero': 1, 'segundo': 2, 'tercero': 3, 'cuarto': 4, 'quinto': 5, 'sexto': 6, 'séptimo': 7, 'septimo': 7, 'octavo': 8, 'noveno': 9 };
  const units = { 'uno': 1, 'una': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7, 'ocho': 8, 'nueve': 9 };
  const teens = { 'diez': 10, 'once': 11, 'doce': 12, 'trece': 13, 'catorce': 14, 'quince': 15, 'dieciséis': 16, 'dieciseis': 16, 'diecisiete': 17, 'dieciocho': 18, 'diecinueve': 19 };
  const twenties = { 'veinte': 20, 'veintiuno': 21, 'veintiuna': 21, 'veintidós': 22, 'veintidos': 22, 'veintitrés': 23, 'veintitres': 23, 'veinticuatro': 24, 'veinticinco': 25, 'veintiséis': 26, 'veintiseis': 26, 'veintisiete': 27, 'veintiocho': 28, 'veintinueve': 29 };
  const tens = { 'treinta': 30, 'cuarenta': 40, 'cincuenta': 50, 'sesenta': 60, 'setenta': 70, 'ochenta': 80, 'noventa': 90 };
  const hundreds = { 'cien': 100, 'ciento': 100, 'doscientos': 200, 'doscientas': 200, 'trescientos': 300, 'trescientas': 300 };

  function convertPart(str) {
    str = str.toLowerCase().trim();
    if (ordinals[str]) return ordinals[str];
    if (units[str]) return units[str];
    if (teens[str]) return teens[str];
    if (twenties[str]) return twenties[str];
    if (tens[str]) return tens[str];
    const tensCompound = str.match(/^(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(\w+)$/i);
    if (tensCompound) {
      const tenValue = tens[tensCompound[1].toLowerCase()] || 0;
      const unitValue = units[tensCompound[2].toLowerCase()] || 0;
      if (tenValue && unitValue) return tenValue + unitValue;
    }
    if (hundreds[str]) return hundreds[str];
    return null;
  }

  const directConversion = convertPart(normalized);
  if (directConversion !== null) {
    return suffix ? `${directConversion} ${suffix}` : String(directConversion);
  }

  const hundredsMatch = normalized.match(/^(cien|ciento|doscientos?|doscientas?|trescientos?|trescientas?)(?:\s+(.+))?$/i);
  if (hundredsMatch) {
    const hundredValue = hundreds[hundredsMatch[1].toLowerCase()] || 0;
    if (hundredsMatch[2]) {
      const rest = convertPart(hundredsMatch[2]);
      if (rest !== null) {
        const total = hundredValue + rest;
        return suffix ? `${total} ${suffix}` : String(total);
      }
    }
    return suffix ? `${hundredValue} ${suffix}` : String(hundredValue);
  }
  return null;
}

(async () => {
  const LO_5_1985_ID = "d69ff916-62c3-4a31-85f0-394a88cc8adf";

  // Obtener artículos de BD
  const { data: dbArticles } = await supabase
    .from("articles")
    .select("article_number")
    .eq("law_id", LO_5_1985_ID);

  const dbSet = new Set(dbArticles.map(a => a.article_number.toLowerCase()));
  console.log("Artículos en BD:", dbSet.size);

  // Obtener artículos del BOE
  const response = await fetch("https://www.boe.es/buscar/act.php?id=BOE-A-1985-11672");
  const html = await response.text();

  const boeArticles = [];
  const regex = /<h5[^>]*class="articulo"[^>]*>Artículo\s+([^<]+)<\/h5>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[1].trim().replace(/\.$/, '');
    // Separar título si existe
    const titleMatch = raw.match(/^(.+?)\.\s+(.+)$/);
    const numPart = titleMatch ? titleMatch[1].trim() : raw;

    const converted = spanishTextToNumber(numPart);
    boeArticles.push({
      raw: numPart,
      converted: converted
    });
  }

  console.log("Artículos en BOE:", boeArticles.length);

  // Encontrar los que no se convirtieron
  const noConvertidos = boeArticles.filter(a => a.converted === null);
  if (noConvertidos.length > 0) {
    console.log("\n❌ NO SE PUDIERON CONVERTIR:");
    noConvertidos.forEach(a => console.log("  -", JSON.stringify(a.raw)));
  }

  // Encontrar los que faltan en BD
  const faltantes = boeArticles.filter(a => {
    if (!a.converted) return false;
    return !dbSet.has(a.converted.toLowerCase());
  });

  if (faltantes.length > 0) {
    console.log("\n❌ CONVERTIDOS PERO NO EN BD:");
    faltantes.forEach(a => console.log("  -", a.raw, "=>", a.converted));
  }

  if (noConvertidos.length === 0 && faltantes.length === 0) {
    console.log("\n✅ Todos los artículos del BOE están en la BD");
  }
})();
