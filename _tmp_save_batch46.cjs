require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.168 reforma total 2/3 (variante)
  const exp1 = `**Articulo 168 de la Constitucion Espanola** (Reforma agravada):

> "Las Camaras elegidas deberan ratificar la decision y proceder al estudio del nuevo texto constitucional, que debera ser aprobado por **mayoria de dos tercios** de ambas Camaras."

**Por que C es correcta (2/3):**
La reforma total de la CE requiere el procedimiento **agravado** del art. 168, con mayoria de **2/3** en todas sus fases:
1. Aprobacion del principio: 2/3 de cada Camara
2. Disolucion de las Cortes y elecciones
3. Las nuevas Camaras aprueban el texto: **2/3**
4. Referendum obligatorio

**Por que las demas son incorrectas:**

- **A)** "3/5". Falso: 3/5 es la mayoria del procedimiento **ordinario** (art. 167), para reformas que no afectan a las partes protegidas. La reforma total siempre va por art. 168.

- **B)** "1/3". Falso: 1/3 no es una mayoria de aprobacion en la CE. No seria suficiente para ninguna reforma.

- **D)** "Mayoria absoluta". Falso: insuficiente para la reforma total. Solo aparece como alternativa subsidiaria en el procedimiento ordinario (art. 167.2).

**Procedimientos de reforma:**
| Tipo | Articulo | Mayoria | Referendum |
|------|----------|---------|------------|
| Ordinaria | 167 | 3/5 | Facultativo |
| **Agravada** (total, T.Preliminar, Sec.1a Cap.II T.I, T.II) | **168** | **2/3** | **Obligatorio** |`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "2a61d974-7ef9-46c0-8ae4-ac37bd8b71ed");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.168 reforma total v2 (" + exp1.length + " chars)");

  // #2 - Ley 39/2006 art.2 tercer sector
  const exp2 = `**Articulo 2.8 de la Ley 39/2006** (Definicion de Tercer Sector):

> "**Tercer sector**: organizaciones de caracter privado surgidas de la iniciativa ciudadana o social, bajo diferentes modalidades que responden a criterios de solidaridad, con fines de interes general y ausencia de animo de lucro, que impulsan el reconocimiento y el ejercicio de los derechos sociales."

**Por que D es correcta:**
El termino legal especifico que usa la Ley 39/2006 para esta definicion es "**Tercer sector**". Es un concepto juridico concreto definido en el art. 2.8 de la ley.

**Por que las demas son incorrectas:**

- **A)** "Sector no lucrativo". Aunque es un concepto similar, **no** es el termino legal que usa la Ley 39/2006. La ley utiliza especificamente "Tercer sector", no "sector no lucrativo".

- **B)** "ONG's". Las ONG son un **tipo** de organizacion que puede formar parte del Tercer sector, pero no es el termino legal de la definicion. Ademas, no todas las organizaciones del Tercer sector son ONG.

- **C)** "Organizaciones de cuidadores no profesionales". Concepto completamente distinto. Los cuidadores no profesionales (art. 2.5) son personas del entorno familiar que atienden a personas dependientes. No tienen relacion con la definicion del enunciado.

**Conceptos clave de la Ley 39/2006:**
| Termino | Definicion |
|---------|------------|
| **Tercer sector** | Organizaciones privadas, sin animo de lucro, de interes general |
| Cuidados no profesionales | Atencion por el entorno familiar |
| Cuidados profesionales | Prestados por institucion o entidad con y sin animo de lucro |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "4af9516b-b06a-403e-b9e5-b200d3ecc3a7");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2006 tercer sector (" + exp2.length + " chars)");

  // #3 - LO 3/2007 Titulo II politicas publicas
  const exp3 = `**Estructura de la LO 3/2007** (Ley de Igualdad):

Cada opcion corresponde a un **Titulo diferente** de la ley:

| Opcion | Contenido | Titulo real |
|--------|-----------|-------------|
| A | Principio de igualdad y tutela contra la discriminacion | **Titulo I** (arts. 3-13) |
| B | Igualdad en la responsabilidad social de las empresas | **Titulo VII** (arts. 73-75) |
| C | Igualdad y medios de comunicacion | **Titulo III** (arts. 36-40) |
| **D** | **Politicas publicas para la igualdad** | **Titulo II** (arts. 14-22) |

**Por que D es correcta:**
El **Titulo II** de la LO 3/2007 se denomina "**Politicas publicas para la igualdad**" y abarca los articulos 14 a 22. Incluye la transversalidad del principio de igualdad, los criterios de actuacion de los poderes publicos, y medidas especificas en educacion, sanidad, politicas urbanas, etc.

**Por que las demas son incorrectas:**

- **A)** "Principio de igualdad y tutela contra la discriminacion" es el **Titulo I**, no el II. Contiene las definiciones basicas (discriminacion directa, indirecta, acoso, represalia).

- **B)** "Igualdad en la responsabilidad social de las empresas" es el **Titulo VII**, no el II. Regula acciones voluntarias de las empresas.

- **C)** "Igualdad y medios de comunicacion" es el **Titulo III**, no el II. Regula la imagen de la mujer en los medios y la publicidad.

**Clave:** T.I = definiciones, T.II = politicas publicas, T.III = medios, T.VII = RSC empresas.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "df09d5b7-8ab8-4d9c-83f4-0b7f64af00c6");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LO 3/2007 Titulo II (" + exp3.length + " chars)");
})();
