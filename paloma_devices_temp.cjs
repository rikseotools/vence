require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const paloma = "0e3b7956-1a2b-42d4-84c8-66e704128fb9";

  console.log("=== TODOS LOS DISPOSITIVOS DE PALOMA ===\n");

  // Obtener todas las interacciones con device_info distinto
  const { data: interactions } = await supabase
    .from("user_interactions")
    .select("device_info, created_at")
    .eq("user_id", paloma)
    .order("created_at", { ascending: false })
    .limit(200);

  // Agrupar por User Agent único
  const devices = {};
  for (const i of interactions || []) {
    const ua = i.device_info?.userAgent || "unknown";
    if (!devices[ua]) {
      devices[ua] = {
        count: 0,
        lastSeen: i.created_at,
        platform: i.device_info?.platform,
        screen: `${i.device_info?.screenWidth}x${i.device_info?.screenHeight}`
      };
    }
    devices[ua].count++;
  }

  // Mostrar dispositivos
  let num = 1;
  for (const [ua, info] of Object.entries(devices)) {
    const iosVer = ua.match(/OS (\d+_\d+)/)?.[1]?.replace("_", ".");
    const safariVer = ua.match(/Version\/(\d+\.\d+)/)?.[1];
    const isIPhone = ua.includes("iPhone");
    const isIPad = ua.includes("iPad") || (info.platform === "MacIntel" && info.screen === "820x1180");
    const isMac = ua.includes("Macintosh") && !isIPad;

    let deviceType = "Desconocido";
    if (isIPhone) deviceType = "iPhone";
    else if (isIPad) deviceType = "iPad";
    else if (isMac) deviceType = "Mac";

    console.log(`--- Dispositivo ${num++} (${deviceType}) ---`);
    console.log(`  Usos: ${info.count}`);
    console.log(`  Último uso: ${info.lastSeen?.split("T")[0]}`);
    console.log(`  Pantalla: ${info.screen}`);
    if (iosVer) console.log(`  iOS: ${iosVer}`);
    if (safariVer) console.log(`  Safari: ${safariVer}`);
    console.log(`  UA: ${ua.substring(0, 80)}...`);
    console.log("");
  }

  // Específicamente buscar redirects de Paloma desde iPhone
  console.log("\n=== REDIRECTS DE PALOMA DESDE IPHONE ===\n");

  const { data: redirects } = await supabase
    .from("user_interactions")
    .select("created_at, device_info")
    .eq("user_id", paloma)
    .like("page_url", "%auth/callback%")
    .order("created_at", { ascending: false })
    .limit(30);

  const iphoneRedirects = redirects?.filter(r => r.device_info?.userAgent?.includes("iPhone")) || [];
  const otherRedirects = redirects?.filter(r => !r.device_info?.userAgent?.includes("iPhone")) || [];

  console.log(`Total redirects: ${redirects?.length || 0}`);
  console.log(`Desde iPhone: ${iphoneRedirects.length}`);
  console.log(`Desde otros dispositivos: ${otherRedirects.length}`);

  if (iphoneRedirects.length > 0) {
    console.log("\nRedirects desde iPhone:");
    iphoneRedirects.slice(0, 5).forEach(r => {
      const iosVer = r.device_info?.userAgent?.match(/OS (\d+_\d+)/)?.[1]?.replace("_", ".");
      console.log(`  ${r.created_at?.split("T")[0]} ${r.created_at?.split("T")[1]?.split(".")[0]} - iOS ${iosVer}`);
    });
  }

})();
