require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 364/1995 art.13 organos de seleccion
  const exp1 = `**Articulo 13 del RD 364/1995** (Reglas sobre organos de seleccion):

> **13.1:** "Los organos de seleccion **no podran estar formados mayoritariamente** por funcionarios pertenecientes al mismo Cuerpo o Escala objeto de la seleccion."

> **13.2:** "**No podran formar parte** de los organos de seleccion aquellos funcionarios que hubiesen realizado **tareas de preparacion de aspirantes** a pruebas selectivas en los **cinco anos anteriores** a la publicacion de la correspondiente convocatoria."

> **13.3:** "Los Tribunales y las Comisiones Permanentes de Seleccion podran disponer la **incorporacion a sus trabajos de asesores especialistas**, para todas o algunas de las pruebas."

**Por que D es correcta:**
Las tres afirmaciones (A, B y C) son verdaderas segun el art. 13, por lo que la respuesta es "Todas son correctas".

- **A)** Correcta: art. 13.1 prohibe que la mayoria del organo sea del mismo Cuerpo/Escala. Busca evitar endogamia y garantizar objetividad.

- **B)** Correcta: art. 13.2 establece una incompatibilidad de 5 anos para preparadores de opositores. Evita conflictos de interes entre quien prepara y quien evalua.

- **C)** Correcta: art. 13.3 permite incorporar asesores especialistas. Estos colaboran solo en sus especialidades tecnicas, no son miembros plenos del tribunal.

**Tres reglas clave del art. 13:**
| Regla | Finalidad |
|-------|-----------|
| No mayoria del mismo Cuerpo | Evitar endogamia |
| Exclusion de preparadores (5 anos) | Evitar conflicto de intereses |
| Asesores especialistas | Apoyo tecnico puntual |`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "0cd430a2-48cf-4db8-acc7-d605a03add58");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 364/1995 art.13 organos seleccion (" + exp1.length + " chars)");

  // #2 - RD 364/1995 art.16 convocatoria
  const exp2 = `**Articulo 16 del RD 364/1995** (Contenido de las convocatorias):

La convocatoria debe contener, **al menos**, las siguientes circunstancias (entre otras):
- a) Numero y **caracteristicas de las plazas** convocadas
- e) **Sistema selectivo**
- h) **Sistema de calificacion**
- j) **Duracion MAXIMA** del proceso de celebracion de los ejercicios

**Por que B es correcta (es la que NO se exige):**
La opcion B dice "duracion **minima**" del proceso, pero el art. 16.j exige la "duracion **MAXIMA**". Es un cambio de una sola palabra que invierte completamente el significado. La convocatoria debe fijar un tope maximo de duracion, no un minimo.

**Por que las demas son incorrectas (si se exigen):**

- **A)** "Caracteristicas de las plazas convocadas". SI se exige: art. 16.a) establece "numero y caracteristicas de las plazas convocadas" como contenido obligatorio.

- **C)** "Sistema selectivo". SI se exige: art. 16.e) incluye expresamente el "sistema selectivo" (oposicion, concurso, o concurso-oposicion).

- **D)** "Sistema de calificacion". SI se exige: art. 16.h) incluye el "sistema de calificacion" como contenido obligatorio de la convocatoria.

**Truco de examen:** Cuidado con el cambio "maxima" por "minima". El art. 16.j establece la duracion **maxima** del proceso. Ademas, fija plazos entre ejercicios: minimo 72 horas y maximo 45 dias naturales entre uno y otro.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "3f46aefe-400d-45d4-bb33-b5f481653864");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - RD 364/1995 art.16 convocatoria (" + exp2.length + " chars)");
})();
