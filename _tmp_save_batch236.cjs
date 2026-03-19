require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Orden HFP/266/2023 art.2 Comisión Permanente Selección
  const exp1 = `**Articulo 2.1 de la Orden HFP/266/2023 - Comision Permanente de Seleccion:**

> "Sus miembros deberan ser personal funcionario de carrera de cuerpos o escalas para cuyo acceso sea requisito un nivel de titulacion **igual o superior** al del cuerpo o escala en cuya seleccion vayan a intervenir, sin perjuicio de poder pertenecer a la Comision con un nivel **inferior** y participar tan solo en aquellas unidades de evaluacion para las que cumpla con los requisitos."

**Por que C es la afirmacion INCORRECTA (y por tanto la respuesta):**
La opcion C contiene dos errores respecto al texto real del art. 2.1:
1. Dice "titulacion **igual**" cuando el articulo dice "titulacion **igual o superior**". Omite "o superior".
2. Dice "sin perjuicio de poder pertenecer con un nivel **superior**" cuando el articulo dice "con un nivel **inferior**". Invierte completamente el sentido: la excepcion permite pertenecer con nivel inferior (no superior), participando solo en evaluaciones para las que se cumplan los requisitos.

**Por que las demas SI son correctas:**

- **A)** "Integrada por una persona en la Presidencia, **cuarenta y cinco** personas en las vocalias y una persona en la Secretaria." **Correcto**: reproduce literalmente el art. 2.1, parrafo primero.

- **B)** "Se promovera la participacion de personas con **discapacidad**, en particular para procesos con turno de reserva." **Correcto**: reproduce el contenido del art. 2.1 sobre promocion de la participacion de personas con discapacidad.

- **D)** "Deberan incluirse personas de **todos los subgrupos** para favorecer la diversidad y el conocimiento tecnico." **Correcto**: reproduce el art. 2.1 sobre la composicion diversa por subgrupos.

**Errores de la opcion C (comparacion):**

| Aspecto | Texto real (art. 2.1) | Opcion C (incorrecta) |
|---------|----------------------|----------------------|
| Nivel titulacion | **Igual o superior** | "Igual" (omite "o superior") |
| Excepcion nivel | Nivel **inferior** | "Nivel **superior**" (invertido) |

**Composicion de la Comision Permanente de Seleccion:**

| Cargo | Numero |
|-------|--------|
| Presidencia | 1 |
| Vocalias | 45 |
| Secretaria | 1 |
| **Total** | **47** |

**Clave:** Los miembros necesitan titulacion "igual o superior" (no solo "igual"), y la excepcion permite nivel "inferior" (no "superior"). La opcion C invierte el sentido de la excepcion.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "86bb7c0c-c87f-4a90-82a2-3ccf9c04ae22");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Orden HFP/266/2023 Comision Permanente (" + exp1.length + " chars)");

  // #2 - RDL 5/2015 art.74 RPT retribuciones complementarias
  const exp2 = `**Articulo 74 del RDL 5/2015 (TREBEP) - Relaciones de puestos de trabajo:**

> "Las Administraciones Publicas estructuraran su organizacion a traves de relaciones de puestos de trabajo [...] que comprenderan, al menos, la **denominacion** de los puestos, los **grupos de clasificacion profesional**, los **cuerpos o escalas** [...] a que esten adscritos, los **sistemas de provision** y las retribuciones **complementarias**."

**Por que D es correcta (retribuciones complementarias, no basicas):**
El art. 74 TREBEP enumera el contenido minimo de las RPT. El ultimo elemento es "las retribuciones **complementarias**" (no las basicas). La opcion D reproduce fielmente estos cinco elementos: denominacion, grupos, cuerpos/escalas, sistemas de provision y retribuciones complementarias.

**Por que las demas son incorrectas:**

- **A)** "Los sistemas de provision y las retribuciones **basicas**." Falso: el art. 74 dice "retribuciones **complementarias**", no "basicas". Las retribuciones basicas (sueldo y trienios, art. 23 TREBEP) dependen del Subgrupo/Grupo, no del puesto concreto. Las complementarias si dependen del puesto, por eso se incluyen en la RPT.

- **B)** "Las retribuciones **basicas y complementarias**." Falso: el art. 74 solo menciona las retribuciones **complementarias**. Anadir "basicas" es un error por exceso. Las basicas no se incluyen en la RPT porque son iguales para todos los funcionarios del mismo Subgrupo.

- **C)** "Los sistemas de provision y las retribuciones **basicas**." Falso por dos motivos: (1) dice "basicas" en lugar de "complementarias"; (2) omite "los cuerpos o escalas, en su caso, a que esten adscritos", que si es un elemento obligatorio de la RPT.

**Contenido minimo de las RPT (art. 74 TREBEP):**

| N.o | Elemento |
|-----|----------|
| 1 | **Denominacion** de los puestos |
| 2 | **Grupos de clasificacion** profesional |
| 3 | **Cuerpos o escalas** adscritos (en su caso) |
| 4 | **Sistemas de provision** |
| 5 | Retribuciones **complementarias** |

**Clave:** Las RPT incluyen retribuciones COMPLEMENTARIAS (no basicas). Las basicas dependen del Subgrupo (art. 23), las complementarias dependen del puesto (art. 24). Logica: la RPT describe puestos, por eso incluye lo que depende del puesto.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "86cab9da-7d2c-4057-9213-a94be42feafe");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - TREBEP art.74 RPT complementarias (" + exp2.length + " chars)");
})();
