require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Word Mayús+Intro = salto de línea (no de párrafo)
  const exp1 = `**Microsoft Word - Salto de linea vs salto de parrafo:**

> En Word, **Mayus + Intro** inserta un **salto de linea** (tambien llamado salto de linea manual o "line break"). A diferencia de **Intro** solo, que inserta un **salto de parrafo**, el salto de linea baja a la siguiente linea sin crear un nuevo parrafo.

**Por que B es correcta (salto de linea):**
Al pulsar **Mayus + Intro** (Shift + Enter) en Word, se inserta un **salto de linea manual**. El texto continua en la linea siguiente pero dentro del **mismo parrafo**. Esto es util cuando se quiere bajar de linea sin cambiar el formato de parrafo (espaciado, sangria, estilo, etc.). En los caracteres ocultos, se muestra como una flecha curvada hacia la izquierda.

**Por que las demas son incorrectas:**

- **A)** "Anadimos un **salto de parrafo**." Falso: el salto de parrafo se inserta con **Intro** (Enter) solo, no con Mayus + Intro. El salto de parrafo crea un nuevo parrafo con su propia marca de parrafo (el simbolo de pi invertida). Mayus + Intro mantiene el mismo parrafo.

- **C)** "Anadimos un **salto de parrafo fuerte**." Falso: no existe el concepto de "salto de parrafo fuerte" en Word. Es un termino inventado que no corresponde a ninguna funcionalidad del programa.

- **D)** "**No ocurre nada**." Falso: Mayus + Intro si tiene una funcion asignada: insertar un salto de linea. Es un atajo estandar que funciona en todas las versiones de Word.

**Diferencia entre salto de linea y salto de parrafo:**

| Tipo | Atajo | Simbolo oculto | Efecto |
|------|-------|---------------|--------|
| **Salto de linea** | **Mayus + Intro** | Flecha curvada | Baja de linea, mismo parrafo |
| Salto de parrafo | Intro | Marca de parrafo (pi) | Crea nuevo parrafo |

**Cuando usar salto de linea (Mayus + Intro):**
- Direcciones postales (cada linea de la direccion en el mismo parrafo)
- Lineas dentro de un mismo elemento de lista
- Cuando se quiere bajar de linea sin cambiar formato de parrafo

**Clave:** Mayus + Intro = salto de linea (misma parrafo). Intro = salto de parrafo (nuevo parrafo). La diferencia es fundamental para el formato del documento.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "e9cdf833-7b24-441d-b24c-48a48f5766f3");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Word Mayus+Intro salto de linea (" + exp1.length + " chars)");
})();
