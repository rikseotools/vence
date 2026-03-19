require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Word salto seccion pagina impar
  const exp1 = `**Salto de seccion de pagina impar en Word:**

Un salto de seccion de pagina impar finaliza la seccion actual e inicia una nueva seccion en la **siguiente pagina con numero impar**. Si la pagina actual ya es impar, Word puede insertar una pagina en blanco intermedia para que la nueva seccion comience en una pagina impar.

**Por que C es correcta:**
El salto de seccion de pagina impar hace exactamente eso: inserta un salto de seccion y comienza la nueva seccion en la siguiente pagina con numero impar. Es muy util para documentos formales donde los capitulos deben empezar siempre en pagina impar (como en libros impresos).

**Por que las demas son incorrectas:**

- **A)** "Un salto de seccion en el medio de la primera pagina con numero impar". Falso: el salto no se inserta "en el medio" de ninguna pagina. El salto termina la pagina actual y la nueva seccion empieza en una pagina nueva completa.

- **B)** "Un salto de seccion en todas las paginas con numero impar". Falso: se inserta **un unico** salto de seccion, no uno en cada pagina impar. Solo afecta al punto donde se inserta.

- **D)** "Un salto de seccion en la mitad superior de todas las paginas". Falso: no tiene relacion con "la mitad superior" ni con "todas las paginas". Un salto de seccion es un unico punto de division.

**Tipos de saltos de seccion en Word:**
- **Pagina siguiente**: nueva seccion en la pagina siguiente
- **Continuo**: nueva seccion en la misma pagina
- **Pagina par**: nueva seccion en la siguiente pagina par
- **Pagina impar**: nueva seccion en la siguiente pagina impar`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "e79799b8-73c3-4615-a28c-bc581e9f316d");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Word salto seccion impar (" + exp1.length + " chars)");

  // #2 - Word buscar y reemplazar (quitar emojis, mejorar formato)
  const exp2 = `**Buscar y reemplazar en Word (Ctrl + H):**

El cuadro de dialogo "Buscar y reemplazar" incluye opciones avanzadas accesibles desde el boton **"Mas >>"**. Todas las opciones mencionadas en la pregunta existen en Word.

**Por que D es correcta:**
Las tres opciones mencionadas (A, B y C) SI estan disponibles en Buscar y reemplazar:

- **A) Coincidir mayusculas y minusculas** - Disponible. Permite distinguir entre mayusculas y minusculas en la busqueda (por ejemplo, buscar "Casa" sin encontrar "casa").

- **B) Solo palabras completas** - Disponible. Evita coincidencias parciales (buscar "mar" no encontrara "marzo" ni "amar").

- **C) Usar caracteres comodin** - Disponible. Permite busquedas con patrones usando simbolos como * (cualquier cadena), ? (un caracter), [] (rango de caracteres).

Como las tres opciones existen, la respuesta es D: "Todas las respuestas anteriores estan disponibles".

**Otras opciones del cuadro Buscar y reemplazar:**
- Buscar prefijos/sufijos
- Omitir signos de puntuacion
- Omitir caracteres de espacio en blanco
- Resaltar todo
- Formato (fuente, parrafo, idioma, etc.)`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "1b0baa01-5800-4da1-ac83-cb4669eb4c2c");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Word buscar reemplazar (" + exp2.length + " chars)");
})();
