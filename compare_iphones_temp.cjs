require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const bea = "25b73691-6965-4711-ba2d-41d5479430dc";
  const paloma = "0e3b7956-1a2b-42d4-84c8-66e704128fb9";

  console.log("=== COMPARACIÓN DE IPHONES: BEA vs PALOMA ===\n");

  // Obtener UA de iPhone de cada una
  const { data: beaIphone } = await supabase
    .from("user_interactions")
    .select("device_info")
    .eq("user_id", bea)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: palomaIphone } = await supabase
    .from("user_interactions")
    .select("device_info")
    .eq("user_id", paloma)
    .like("device_info->>userAgent", "%iPhone%")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const beaUA = beaIphone?.device_info?.userAgent || "";
  const palomaUA = palomaIphone?.device_info?.userAgent || "";

  console.log("BEA iPhone UA:");
  console.log(`  ${beaUA}`);
  console.log("");
  console.log("PALOMA iPhone UA:");
  console.log(`  ${palomaUA}`);
  console.log("");

  // Extraer y comparar
  const extract = (ua) => ({
    ios: ua.match(/OS (\d+_\d+)/)?.[1]?.replace("_", "."),
    safari: ua.match(/Version\/(\d+\.\d+)/)?.[1],
    webkit: ua.match(/AppleWebKit\/(\d+\.\d+)/)?.[1],
    mobile: ua.match(/Mobile\/(\w+)/)?.[1],
  });

  const beaInfo = extract(beaUA);
  const palomaInfo = extract(palomaUA);

  const beaScreen = `${beaIphone?.device_info?.screenWidth}x${beaIphone?.device_info?.screenHeight}`;
  const palomaScreen = `${palomaIphone?.device_info?.screenWidth}x${palomaIphone?.device_info?.screenHeight}`;

  console.log("=== TABLA COMPARATIVA IPHONES ===\n");
  console.log("Característica   | Bea              | Paloma           | ¿Igual?");
  console.log("-".repeat(70));

  const comparisons = [
    ["iOS", beaInfo.ios, palomaInfo.ios],
    ["Safari", beaInfo.safari, palomaInfo.safari],
    ["WebKit", beaInfo.webkit, palomaInfo.webkit],
    ["Mobile Build", beaInfo.mobile, palomaInfo.mobile],
    ["Pantalla", beaScreen, palomaScreen],
    ["isStandalone", beaIphone?.device_info?.isStandalone, palomaIphone?.device_info?.isStandalone],
  ];

  for (const [label, beaVal, palomaVal] of comparisons) {
    const equal = String(beaVal) === String(palomaVal) ? "✅ SÍ" : "❌ NO";
    console.log(`${label.padEnd(16)} | ${String(beaVal || "?").padEnd(16)} | ${String(palomaVal || "?").padEnd(16)} | ${equal}`);
  }

  // Detectar modelos por pantalla
  const screenToModel = {
    "430x932": "iPhone 14 Pro / 15 / 15 Pro",
    "393x852": "iPhone 14 / 15",
    "428x926": "iPhone 12/13 Pro Max / 14 Plus",
    "390x844": "iPhone 12/13/14",
    "414x896": "iPhone XR / XS Max / 11 / 11 Pro Max",
    "375x812": "iPhone X/XS/11 Pro",
    "414x736": "iPhone 6/7/8 Plus",
    "375x667": "iPhone 6/7/8/SE",
  };

  console.log("");
  console.log("=== MODELOS DE IPHONE ESTIMADOS ===\n");
  console.log(`Bea (${beaScreen}): ${screenToModel[beaScreen] || "Modelo desconocido"}`);
  console.log(`Paloma (${palomaScreen}): ${screenToModel[palomaScreen] || "Modelo desconocido"}`);

  // ¿Ambas iOS 18?
  const beaIOSMajor = beaInfo.ios?.split(".")[0];
  const palomaIOSMajor = palomaInfo.ios?.split(".")[0];

  console.log("");
  console.log("=== CONCLUSIONES ===\n");
  console.log(`¿Ambas iOS 18? ${beaIOSMajor === "18" && palomaIOSMajor === "18" ? "SÍ ✅" : "NO"}`);
  console.log(`¿Mismo WebKit? ${beaInfo.webkit === palomaInfo.webkit ? "SÍ ✅" : "NO"}`);
  console.log(`¿Mismo Mobile build? ${beaInfo.mobile === palomaInfo.mobile ? "SÍ ✅" : "NO"}`);
  console.log(`¿Mismo modelo iPhone? ${beaScreen === palomaScreen ? "SÍ" : "NO - Diferentes modelos"}`);

  // Comparar con usuario SIN bug
  console.log("\n\n=== COMPARACIÓN CON USUARIO iOS SIN BUG ===\n");

  // Buscar un usuario iOS que NO tenga bugs
  // Usar "Jorge Ramos" que tenía 0 bugs
  const { data: jorgeProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .ilike("full_name", "%Jorge Ramos%")
    .single();

  if (jorgeProfile) {
    const { data: jorgeIphone } = await supabase
      .from("user_interactions")
      .select("device_info")
      .eq("user_id", jorgeProfile.id)
      .like("device_info->>userAgent", "%iPhone%")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const jorgeUA = jorgeIphone?.device_info?.userAgent || "";
    const jorgeInfo = extract(jorgeUA);
    const jorgeScreen = `${jorgeIphone?.device_info?.screenWidth}x${jorgeIphone?.device_info?.screenHeight}`;

    console.log("Jorge Ramos (0 bugs reales):");
    console.log(`  iOS: ${jorgeInfo.ios}`);
    console.log(`  Safari: ${jorgeInfo.safari}`);
    console.log(`  WebKit: ${jorgeInfo.webkit}`);
    console.log(`  Pantalla: ${jorgeScreen}`);
    console.log(`  Modelo: ${screenToModel[jorgeScreen] || "Desconocido"}`);
    console.log(`  UA: ${jorgeUA.substring(0, 80)}...`);
  }

})();
