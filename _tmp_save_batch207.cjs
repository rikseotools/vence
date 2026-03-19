require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 47/2003 art.40 créditos operaciones corrientes
  const exp1 = `**Articulo 40.1.c) de la Ley 47/2003 General Presupuestaria - Clasificacion economica:**

> "En los creditos para **operaciones corrientes** se distinguiran los **gastos de personal**, los **gastos corrientes en bienes y servicios**, los **gastos financieros** y las **transferencias corrientes**."

**Por que A es correcta (4 conceptos: personal, bienes/servicios, financieros, transferencias corrientes):**
El art. 40.1.c) enumera exactamente cuatro categorias dentro de las operaciones corrientes: gastos de personal, gastos corrientes en bienes y servicios, gastos financieros y transferencias corrientes. La opcion A reproduce fielmente esta enumeracion.

**Por que las demas son incorrectas (mezclan categorias):**

- **B)** Anade "**inversiones reales**" a la lista. Falso: las inversiones reales pertenecen a las **operaciones de capital**, no a las corrientes. El art. 40.1.c) separa: "En los creditos para operaciones de capital se distinguiran las inversiones reales y las transferencias de capital."

- **C)** Anade "**activo financiero y pasivo financiero**". Falso: los activos y pasivos financieros pertenecen a las **operaciones financieras**, una categoria separada. El art. 40.1.c) dice: "En los creditos para operaciones financieras se distinguiran las de activos financieros y las de pasivos financieros."

- **D)** Omite "**gastos de personal**" y anade "**Fondo de Contingencia**". Falso: los gastos de personal son el primer concepto de las operaciones corrientes. El Fondo de Contingencia es una categoria independiente (art. 40.1.c y art. 50), no forma parte de las operaciones corrientes.

**Estructura de la clasificacion economica (art. 40.1.c):**

| Tipo de operacion | Capitulos |
|-------------------|-----------|
| **Corrientes** | Personal, bienes/servicios, financieros, transferencias corrientes |
| Capital | Inversiones reales, transferencias de capital |
| Financieras | Activos financieros, pasivos financieros |
| Fondo de Contingencia | Dotacion para necesidades imprevistas |

**Clave:** Operaciones corrientes = 4 capitulos (personal + bienes/servicios + financieros + transferencias corrientes). No incluye inversiones, activos/pasivos financieros ni Fondo de Contingencia.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "5c7a19b4-c446-40f9-889c-56da57dba81c");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 47/2003 art.40 operaciones corrientes (" + exp1.length + " chars)");

  // #2 - CE art.29.2 derecho de petición colectiva Fuerzas Armadas
  const exp2 = `**Articulo 29 de la Constitucion Espanola - Derecho de peticion:**

> Art. 29.1: "Todos los espanoles tendran el derecho de peticion **individual y colectiva**, por escrito, en la forma y con los efectos que determine la ley."
>
> Art. 29.2: "Los miembros de las **Fuerzas o Institutos armados** o de los Cuerpos sometidos a **disciplina militar** podran ejercer este derecho solo **individualmente** y con arreglo a lo dispuesto en su legislacion especifica."

**Por que A es correcta (Fuerzas Armadas no pueden colectivamente):**
El art. 29.2 CE restringe el derecho de peticion de los miembros de las Fuerzas Armadas y Cuerpos de disciplina militar: solo pueden ejercerlo **individualmente**. Quedan excluidos de la peticion **colectiva**. Esta restriccion se justifica por las exigencias de disciplina y jerarquia propias de la organizacion militar.

**Por que las demas son incorrectas:**

- **B)** "Los **extranjeros** sin residencia legal en Espana." Falso: el art. 29 habla de "todos los espanoles", pero la restriccion especifica de la peticion colectiva solo se aplica a militares (art. 29.2). Los extranjeros tienen sus propios derechos regulados en el art. 13 CE, pero el art. 29.2 no los menciona como grupo restringido para la peticion colectiva.

- **C)** "Los **trabajadores** en el ejercicio de la defensa de sus derechos." Falso: los trabajadores no tienen ninguna restriccion especifica en el art. 29 CE respecto al derecho de peticion. Ademas, los trabajadores tienen otros cauces (huelga, negociacion colectiva) que no se confunden con el derecho de peticion.

- **D)** "Los miembros de las **Camaras**." Falso: los diputados y senadores no estan mencionados en el art. 29.2 como grupo restringido. No existe prohibicion constitucional de que los parlamentarios ejerzan la peticion colectiva, aunque en la practica utilizan otros mecanismos (proposiciones, preguntas, interpelaciones).

**Derecho de peticion (art. 29 CE):**

| Sujeto | Individual | Colectiva |
|--------|-----------|-----------|
| Ciudadanos en general | Si | Si |
| **Fuerzas Armadas / disciplina militar** | **Si** | **No** |

**Clave:** Solo los miembros de Fuerzas Armadas y Cuerpos de disciplina militar tienen restringida la peticion colectiva (art. 29.2). Pueden pedir individualmente, nunca colectivamente.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "b3773692-5475-4845-a405-4647c74b9cf1");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.29 peticion colectiva (" + exp2.length + " chars)");

  // #3 - CE art.151.2.2º formulación definitiva Estatuto
  const exp3 = `**Articulo 151.2 de la Constitucion Espanola - Elaboracion del Estatuto por via especial:**

> Art. 151.2.2.o: "Aprobado el proyecto de Estatuto por la Asamblea de Parlamentarios, se remitira a la **Comision Constitucional del Congreso**, la cual, dentro del plazo de dos meses, lo examinara con el **concurso y asistencia de una delegacion de la Asamblea** proponente para determinar de comun acuerdo su **formulacion definitiva**."

**Por que B es correcta (Comision Constitucional + delegacion de la Asamblea):**
Segun el art. 151.2.2.o CE, la formulacion definitiva del Estatuto corresponde a la **Comision Constitucional del Congreso**, pero no actua sola: lo hace con el **concurso y asistencia** de una delegacion de la Asamblea de parlamentarios que elaboro el proyecto. Es un proceso conjunto, de "comun acuerdo".

**Por que las demas son incorrectas:**

- **A)** "A una **Asamblea** constituida a tal efecto [...]" Falso: la Asamblea de Diputados y Senadores de las circunscripciones afectadas elabora el **proyecto** de Estatuto (art. 151.2.1.o), pero no la formulacion definitiva. Esa Asamblea envia una delegacion para asistir a la Comision Constitucional, pero no decide sola.

- **C)** "A la **Comision Constitucional del Congreso**" (sola). Falso: el art. 151.2.2.o exige que la Comision actue "con el concurso y asistencia de una delegacion de la Asamblea proponente". La Comision no puede formular el texto definitivo en solitario; necesita la participacion de la delegacion autonomica.

- **D)** "A la Comision Constitucional del Congreso, **del Senado** y a la Asamblea." Falso: el art. 151.2.2.o solo menciona la Comision Constitucional **del Congreso**, no del Senado. No interviene ninguna comision senatorial en esta fase. Ademas, interviene una "delegacion" de la Asamblea, no la Asamblea completa.

**Fases del procedimiento del art. 151.2 CE:**

| Fase | Organo |
|------|--------|
| 1.o Elaboracion del proyecto | Asamblea de Diputados y Senadores (mayoria absoluta) |
| **2.o Formulacion definitiva** | **Comision Constitucional del Congreso + delegacion de la Asamblea** |
| 3.o Ratificacion popular | Referendum (mayoria de votos validos por provincia) |
| 4.o Ratificacion parlamentaria | Plenos de Congreso y Senado |
| 5.o Sancion y promulgacion | El Rey |

**Clave:** Formulacion definitiva = Comision Constitucional del Congreso (no del Senado) + delegacion de la Asamblea (no la Asamblea completa ni la Comision sola).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "a4c947ad-2f1b-4f36-b1cd-cfa56f012bec");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.151.2 formulacion Estatuto (" + exp3.length + " chars)");
})();
