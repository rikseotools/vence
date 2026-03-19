require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 1708/2011 art.7 Sistema de Archivos AGE
  const exp1 = `**Articulo 7 del RD 1708/2011 - Sistema de Archivos de la AGE:**

> "Integran el Sistema de Archivos de la Administracion General del Estado los archivos, centros, servicios y, en su caso, sistemas archivisticos de los **departamentos ministeriales**, y de sus **organismos publicos** existentes y los que en el futuro puedan crearse **reglamentariamente**."

**Por que D es correcta:**
La opcion D reproduce fielmente el art. 7 del RD 1708/2011: integran el Sistema los archivos de departamentos ministeriales y organismos publicos existentes, y los que puedan crearse **reglamentariamente**. La palabra clave es "reglamentariamente" (por norma reglamentaria), no "legalmente" (por ley).

**Por que las demas son incorrectas:**

- **A)** Dice "los que en el futuro puedan crearse **legalmente**." Falso: el art. 7 dice "**reglamentariamente**", no "legalmente". La diferencia es significativa: "reglamentariamente" se refiere a normas infra-legales (reales decretos, ordenes), mientras que "legalmente" implica rango de ley.

- **B)** Anade "fondos o colecciones documentales que pertenezcan a **personas fisicas o juridicas sujetas a derecho privado**" y dice "legalmente". Falso por dos motivos: (1) el Sistema de Archivos de la AGE no incluye fondos privados; (2) dice "legalmente" en lugar de "reglamentariamente".

- **C)** Anade tambien "personas fisicas o juridicas sujetas a derecho privado" y dice "legalmente". Falso por las mismas dos razones que B.

**Diferencias clave entre las opciones:**

| Opcion | Fondos privados | Creacion futura |
|--------|----------------|-----------------|
| A | No incluye | "Legalmente" (incorrecto) |
| B | Incluye (incorrecto) | "Reglamentariamente" pero con fondos privados |
| C | Incluye (incorrecto) | "Legalmente" (incorrecto) |
| **D** | **No incluye (correcto)** | **"Reglamentariamente" (correcto)** |

**Clave:** Solo archivos de departamentos y organismos publicos (no fondos privados). Creacion futura: "reglamentariamente" (no "legalmente").`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "50cc96e0-a341-46f0-89e6-26ef128fbaa1");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 1708/2011 art.7 Sistema Archivos (" + exp1.length + " chars)");

  // #2 - Windows 11 Duplicar pantallas
  const exp2 = `**Windows 11 - Configuracion de varias pantallas: "Duplicar estas pantallas":**

**Por que A es correcta (vemos lo mismo en las dos pantallas):**
Al seleccionar **"Duplicar estas pantallas"** en la configuracion de Pantalla (Configuracion > Sistema > Pantalla > Varias pantallas), ambas pantallas muestran exactamente el **mismo contenido** simultaneamente. La resolucion se ajusta a la mas baja de las dos pantallas. Es la opcion mas utilizada para presentaciones, donde el ponente quiere ver lo mismo que la audiencia.

**Por que las demas son incorrectas:**

- **B)** "Vemos objetos diferentes en cada pantalla y podemos mover elementos entre ellas." Falso: esa descripcion corresponde a **"Extender estas pantallas"**, no a "Duplicar". Extender crea un escritorio ampliado donde cada pantalla muestra contenido diferente y se pueden arrastrar ventanas de una a otra.

- **C)** "Se crea una copia duplicada en el disco duro de los archivos." Falso: "Duplicar pantallas" se refiere a la **senal de video** (lo que se ve en pantalla), no a los archivos del disco duro. No se duplican ni copian archivos; simplemente ambos monitores muestran la misma imagen.

- **D)** "Todo el contenido en la primera pantalla. La segunda se queda en negro." Falso: esa descripcion corresponde a **"Mostrar solo en 1"**, que desactiva la segunda pantalla. "Duplicar" muestra contenido en **ambas** pantallas, no solo en una.

**Opciones de varias pantallas en Windows 11:**

| Opcion | Efecto |
|--------|--------|
| **Duplicar** | **Mismo contenido en ambas pantallas** |
| Extender | Escritorio ampliado (contenido diferente) |
| Solo en 1 | Solo primera pantalla activa |
| Solo en 2 | Solo segunda pantalla activa |

**Atajo de teclado:** Win + P abre rapidamente el selector de modo de proyeccion.

**Clave:** Duplicar = mismo contenido en ambas. Extender = escritorio ampliado con contenido diferente.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "ddb0e40c-2bd4-45e2-b013-9c6bfd063ae3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Windows 11 Duplicar pantallas (" + exp2.length + " chars)");
})();
