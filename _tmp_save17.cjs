require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 116 de la Constitucion Espanola** (Estados excepcionales):

La intervencion del Congreso es distinta en cada estado:

| Estado | Declaracion | Prorroga |
|--------|------------|----------|
| **Alarma** (116.2) | Gobierno (solo da cuenta al Congreso) | Congreso autoriza |
| **Excepcion** (116.3) | Gobierno con autorizacion previa del Congreso | Congreso autoriza |
| **Sitio** (116.4) | Congreso por mayoria absoluta, a propuesta del Gobierno | - |

La pregunta pide la funcion que **NO** corresponde al Congreso.

**Por que B es correcta (NO es funcion del Congreso):**
"Autorizar la declaracion del estado de alarma" no es funcion del Congreso. El art. 116.2 dice que el estado de alarma lo declara el Gobierno mediante decreto en Consejo de Ministros, solo "dando cuenta" al Congreso (informandole, no pidiendole autorizacion).

**Por que las demas SI son funciones del Congreso:**

- **A)** "Autorizar la prorroga del estado de alarma" - Si. El art. 116.2 dice "sin cuya autorizacion [del Congreso] no podra ser prorrogado dicho plazo".

- **C)** "Autorizar la prorroga del estado de excepcion" - Si. El art. 116.3 preve la prorroga con autorizacion del Congreso.

- **D)** "Autorizar la declaracion del estado de excepcion" - Si. El art. 116.3 exige "previa autorizacion del Congreso" para declarar el estado de excepcion.

**Clave:** Alarma = Gobierno declara solo (Congreso solo prorroga). Excepcion = Congreso autoriza declaracion y prorroga. Sitio = Congreso declara directamente.`;

  const { error } = await supabase
    .from("questions")
    .update({ explanation })
    .eq("id", "b8651a40-6bbd-4252-a831-57b2c541bcf2");

  if (error) console.error("Error:", error);
  else console.log("OK - CE art.116 estados guardada (" + explanation.length + " chars)");
})();
