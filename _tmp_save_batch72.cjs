require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 1/2004 art.19 principios servicios atencion
  const exp1 = `**Articulo 19.1 de la LO 1/2004:**

> "La organizacion de estos servicios por parte de las comunidades autonomas y las Corporaciones Locales respondera a los principios de **atencion permanente**, **actuacion urgente**, **especializacion de prestaciones** y **multidisciplinariedad profesional**."

**Por que A es correcta:**
Los 4 principios del art. 19.1 son exactamente:
1. **Atencion permanente**
2. **Actuacion urgente**
3. **Especializacion de prestaciones**
4. **Multidisciplinariedad profesional**

La opcion A reproduce los 4 principios textualmente.

**Por que las demas son incorrectas (cada una cambia o elimina palabras):**

- **B)** "Atencion continua, gratuidad, especializacion y multidisciplinariedad". Errores multiples:
  - Cambia "**permanente**" por "continua"
  - Anade "**gratuidad**" (no aparece en el art. 19.1)
  - Elimina "actuacion urgente"
  - Recorta "especializacion **de prestaciones**" a solo "especializacion"
  - Recorta "multidisciplinariedad **profesional**" a solo "multidisciplinariedad"

- **C)** "Atencion permanente y actuacion urgente". Falso: solo menciona **2 de los 4** principios. Falta la especializacion de prestaciones y la multidisciplinariedad profesional. Es incompleta.

- **D)** "Eficacia, eficiencia, atencion permanente y especializacion profesional". Errores multiples:
  - Anade "**eficacia**" y "**eficiencia**" (no son principios del art. 19)
  - Elimina "actuacion urgente"
  - Cambia "especializacion de **prestaciones**" por "especializacion **profesional**"
  - Elimina "multidisciplinariedad profesional"

**Clave para memorizar los 4 principios (AAEM):**
- **A**tencion permanente
- **A**ctuacion urgente
- **E**specializacion de prestaciones
- **M**ultidisciplinariedad profesional

Las trampas tipicas son: cambiar "permanente" por "continua", anadir "gratuidad/eficacia/eficiencia", o dar una lista incompleta.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "1bcee5ea-ddc0-4408-a0b7-8b35a9e307f1");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 1/2004 principios servicios (" + exp1.length + " chars)");
})();
