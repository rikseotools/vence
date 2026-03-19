require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LCSP art.63 encargos publicacion 5.000 euros
  const exp1 = `**Articulo 63 de la Ley 9/2017 (LCSP)** - Perfil de contratante:

> La informacion relativa a los encargos debera publicarse **al menos trimestralmente** en el perfil de contratante cuando su importe fuese **superior a 5.000 euros**.

**Por que D es correcta (5.000 euros):**
El umbral de publicacion trimestral de encargos en el perfil de contratante es de **5.000 euros**. Es un umbral relativamente bajo para garantizar la maxima transparencia en la contratacion publica.

**Por que las demas son incorrectas:**

- **A)** "Superior a 10.000 euros". Falso: el umbral es 5.000, no 10.000. El importe de 10.000 euros no se corresponde con este requisito.

- **B)** "Superior a 20.000 euros". Falso: el umbral es 5.000, no 20.000. Los 20.000 euros aparecen en otros contextos de la LCSP (ej: limite para contratos menores de servicios).

- **C)** "Superior a 15.000 euros". Falso: el umbral es 5.000, no 15.000. Los 15.000 euros aparecen como limite de contratos menores de obras.

**Cifras frecuentes en la LCSP:**
| Importe | Contexto |
|---------|----------|
| **5.000** | Publicacion de encargos en perfil de contratante |
| 15.000 | Contrato menor de obras |
| 20.000 | Contrato menor de servicios/suministros |

**Clave:** Encargos publicados trimestralmente si superan **5.000** euros.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "42d0f394-86f6-44b0-8c97-b7311c7c8a95");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LCSP art.63 encargos 5000 (" + exp1.length + " chars)");

  // #2 - Ley 4/2023 art.3 expresion de genero
  const exp2 = `**Articulo 3.j) de la Ley 4/2023** (Definiciones):

> "**Expresion de genero**: Manifestacion que cada persona hace de su **identidad sexual**."

**Por que C es correcta:**
La Ley 4/2023 define "expresion de genero" como la **manifestacion** (externa, visible) que cada persona hace de su identidad sexual. Incluye la apariencia, la vestimenta, el comportamiento, la forma de hablar, etc.

**Por que las demas son incorrectas (son otros conceptos del art. 3):**

| Opcion | Concepto | Definicion |
|--------|----------|------------|
| A | Orientacion sexual | **Atraccion** fisica, sexual o afectiva hacia otras personas |
| B | Identidad sexual | Vivencia **interna e individual** del sexo tal y como cada persona la siente |
| **C** | **Expresion de genero** | **Manifestacion** que cada persona hace de su identidad sexual |
| D | Intersexualidad | Personas nacidas con **caracteristicas sexuales biologicas** diversas |

- **A)** "Orientacion sexual" (art. 3.h): es la **atraccion** hacia otros, no la manifestacion de la identidad. Ej: heterosexual, homosexual, bisexual.

- **B)** "Identidad sexual" (art. 3.i): es la vivencia **interna** del sexo. La expresion de genero es su manifestacion **externa**. Identidad es lo que sientes; expresion es como lo muestras.

- **D)** "Intersexualidad" (art. 3.l): se refiere a personas con **caracteristicas sexuales biologicas** (cromosomas, hormonas, genitales) que no encajan en las categorias tipicas. No tiene relacion con la manifestacion de la identidad.

**Clave:** Identidad = vivencia **interna**. Expresion = manifestacion **externa**.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "93b8c0ac-53af-4f4e-b30f-be0f88c50b41");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 4/2023 expresion genero (" + exp2.length + " chars)");
})();
