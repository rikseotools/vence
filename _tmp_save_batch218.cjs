require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.11 nacionalidad en Título Primero
  const exp1 = `**Articulo 11 de la Constitucion Espanola - Nacionalidad:**

> Art. 11.1: "La nacionalidad espanola se adquiere, se conserva y se pierde de acuerdo con lo establecido por la ley."

**Por que A es correcta (Titulo Primero):**
El art. 11 CE se encuentra en el **Titulo I** ("De los Derechos y Deberes Fundamentales"), concretamente en su **Capitulo Primero** ("De los espanoles y los extranjeros", arts. 11-13). El Titulo I abarca los articulos 10 a 55 de la Constitucion.

**Por que las demas son incorrectas:**

- **B)** "En el **Titulo Preliminar**." Falso: el Titulo Preliminar comprende los arts. 1-9, que recogen los principios fundamentales del Estado (forma politica, soberania, unidad territorial, bandera, capitalidad, etc.). El art. 11 no esta ahi.

- **C)** "En el **Preambulo**." Falso: el Preambulo es un texto introductorio de la CE que carece de articulos numerados. No tiene fuerza normativa vinculante directa. La nacionalidad se regula en un articulo concreto (art. 11), no en el Preambulo.

- **D)** "En el **Titulo II**." Falso: el Titulo II regula "La Corona" (arts. 56-65), es decir, la figura del Rey, sus funciones, la sucesion y el refrendo. No tiene relacion con la nacionalidad.

**Estructura de la CE (Titulos I-II):**

| Titulo | Contenido | Articulos |
|--------|-----------|-----------|
| Preliminar | Principios fundamentales | 1-9 |
| **I** | **Derechos y Deberes Fundamentales** | **10-55** |
| II | La Corona | 56-65 |

**Capitulos del Titulo I:**

| Capitulo | Contenido | Articulos |
|----------|-----------|-----------|
| **1.o** | **Espanoles y extranjeros (nacionalidad)** | **11-13** |
| 2.o | Derechos y libertades | 14-38 |
| 3.o | Principios rectores | 39-52 |
| 4.o | Garantias | 53-54 |
| 5.o | Suspension de derechos | 55 |

**Clave:** Art. 11 (nacionalidad) = Titulo I, Capitulo 1.o. No confundir con el Titulo Preliminar (arts. 1-9) ni con el Titulo II (La Corona).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a8cd32e0-8bdf-415d-8b15-cc691b2357e3");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.11 nacionalidad Titulo I (" + exp1.length + " chars)");

  // #2 - Word 365 función Editor ortografía/gramática
  const exp2 = `**Word 365 - Funcion Editor:**

**Por que B es correcta (ortografia, gramatica y sugerencias de escritura):**
El **Editor** de Word 365 es una herramienta integrada que **comprueba la ortografia, la gramatica y ofrece sugerencias de escritura** para mejorar el estilo del documento. Analiza el texto en segundo plano y muestra subrayados de colores para indicar diferentes tipos de problemas: rojo (ortografia), azul (gramatica) y morado (sugerencias de estilo). Se accede desde la pestana **Inicio** o desde **Revisar**.

**Por que las demas son incorrectas (describen otras funciones):**

- **A)** "Cambia la **vista** del documento para ver unicamente el texto." Falso: esa descripcion corresponde a las opciones de **vista** (Borrador, Esquema), no al Editor. Las vistas se gestionan desde la pestana Vista. El Editor no modifica como se visualiza el documento.

- **C)** "Utiliza la **voz** para crear contenido en un documento." Falso: esa funcion es el **Dictado** (Inicio > Dictado), que convierte la voz en texto. El Editor no usa la voz; analiza texto ya escrito.

- **D)** "Ofrece una lista de **antonimos** de la palabra seleccionada." Falso: esa funcion corresponde al **Tesauro** o **Sinonimos** (Revisar > Tesauro). El tesauro ofrece sinonimos y antonimos. El Editor no busca antonimos; revisa ortografia, gramatica y estilo.

**Funciones de Word y donde encontrarlas:**

| Funcion | Herramienta | Pestana |
|---------|-------------|---------|
| **Ortografia/gramatica/estilo** | **Editor** | **Inicio / Revisar** |
| Vistas del documento | Borrador, Esquema, Lectura | Vista |
| Voz a texto | Dictado | Inicio |
| Sinonimos/antonimos | Tesauro | Revisar |

**Clave:** Editor = ortografia + gramatica + sugerencias de estilo. No confundir con Dictado (voz), Tesauro (sinonimos) ni las vistas del documento.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "2ca3d69b-eec4-44f0-8cf2-da06a4f52ee3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Word Editor funcion (" + exp2.length + " chars)");
})();
