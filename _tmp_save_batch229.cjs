require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 7/1985 art.44 mancomunidades afirmación falsa
  const exp1 = `**Articulo 44.3 de la Ley 7/1985 (LBRL) - Estatutos de las mancomunidades:**

> "El procedimiento de aprobacion de los estatutos de las mancomunidades [...] se ajustara, en todo caso, a las siguientes reglas:
> a) La elaboracion correspondera a los **concejales** de la totalidad de los municipios promotores, constituidos en **asamblea**.
> b) La **Diputacion o Diputaciones provinciales** interesadas emitiran **informe** sobre el proyecto de estatutos.
> c) Los **Plenos de todos los ayuntamientos** aprueban los estatutos."

**Por que B es la afirmacion FALSA (y por tanto la respuesta):**
La opcion B dice que "la Comunidad Autonoma debe someter la propuesta de los Estatutos a **votacion de la totalidad del Parlamento**." Falso: el art. 44.3 LBRL no atribuye ningun papel al Parlamento autonomico en la aprobacion de estatutos de mancomunidades. El procedimiento es exclusivamente **municipal**: elaboran los concejales, informa la Diputacion y aprueban los Plenos de los ayuntamientos. La CCAA solo determina el procedimiento (art. 44.3: "se determinara por la legislacion de las CCAA"), pero no vota los estatutos.

**Por que las demas SI son correctas:**

- **A)** "La elaboracion correspondera a los **concejales** de la totalidad de los municipios promotores, constituidos en **asamblea**." **Correcto**: reproduce literalmente el art. 44.3.a) LBRL.

- **C)** "La Diputacion o Diputaciones provinciales interesadas emitiran **informe** sobre el proyecto de estatutos." **Correcto**: reproduce literalmente el art. 44.3.b) LBRL. La Diputacion solo informa, no aprueba.

- **D)** "Los **Plenos de todos los ayuntamientos** aprueban los estatutos." **Correcto**: reproduce literalmente el art. 44.3.c) LBRL. La aprobacion final corresponde a cada Pleno municipal.

**Procedimiento de aprobacion de estatutos de mancomunidades (art. 44.3 LBRL):**

| Fase | Organo | Funcion |
|------|--------|---------|
| 1. Elaboracion | Concejales en asamblea | Redactan el proyecto |
| 2. Informe | Diputacion Provincial | Emiten informe (no vinculante) |
| 3. Aprobacion | **Plenos de todos los ayuntamientos** | Aprueban los estatutos |

**Clave:** Los estatutos de mancomunidades son aprobados por los Plenos municipales, NO por el Parlamento autonomico. La CCAA regula el procedimiento pero no vota los estatutos.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "0149f342-41b4-4d0b-affe-95879dfc6ecd");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LBRL art.44 mancomunidades (" + exp1.length + " chars)");

  // #2 - Informática unidades bytes Exabyte mayor
  const exp2 = `**Unidades de medida de informacion digital - Escala de bytes:**

> La escala de unidades de almacenamiento digital sigue un orden creciente: Byte (B) < Kilobyte (KB) < Megabyte (MB) < Gigabyte (GB) < Terabyte (TB) < Petabyte (PB) < **Exabyte (EB)** < Zettabyte (ZB) < Yottabyte (YB). Cada unidad equivale a **1.024** veces la anterior.

**Por que D es correcta (Exabyte es la mayor):**
De las cuatro opciones, el **Exabyte (EB)** es la unidad que representa mayor cantidad de bytes. Un Exabyte equivale a 1.024 Petabytes, que a su vez equivalen a 1.024 Terabytes cada uno. Es la unidad mas alta de las cuatro opciones presentadas.

**Por que las demas son menores:**

- **A)** "1 **Kilobyte** (KB)." Es la unidad mas pequena de las cuatro opciones. 1 KB = 1.024 bytes. Es la base de la escala (por encima del byte).

- **C)** "1 **Terabyte** (TB)." Menor que Petabyte y Exabyte. 1 TB = 1.024 GB. Es la capacidad tipica de un disco duro actual.

- **B)** "1 **Petabyte** (PB)." Menor que Exabyte. 1 PB = 1.024 TB. Usado en centros de datos y almacenamiento masivo.

**Escala completa de unidades (de menor a mayor):**

| Unidad | Simbolo | Equivalencia |
|--------|---------|-------------|
| Byte | B | 8 bits |
| **Kilobyte** | **KB** | 1.024 B |
| Megabyte | MB | 1.024 KB |
| Gigabyte | GB | 1.024 MB |
| **Terabyte** | **TB** | 1.024 GB |
| **Petabyte** | **PB** | 1.024 TB |
| **Exabyte** | **EB** | **1.024 PB** |
| Zettabyte | ZB | 1.024 EB |
| Yottabyte | YB | 1.024 ZB |

**Regla mnemotecnica:** **K**ilo - **M**ega - **G**iga - **T**era - **P**eta - **E**xa - **Z**etta - **Y**otta. Cada salto multiplica por 1.024.

**Clave:** El orden de las opciones de menor a mayor es: KB < TB < PB < EB. El Exabyte es la mayor.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "6bb9cacf-9f5f-41d9-80b7-c43cd759e64d");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Informatica Exabyte mayor (" + exp2.length + " chars)");

  // #3 - CE art.17.2 detención preventiva 72 horas
  const exp3 = `**Articulo 17.2 de la Constitucion Espanola - Detencion preventiva:**

> "La detencion preventiva no podra durar mas del tiempo estrictamente necesario para la realizacion de las averiguaciones tendentes al esclarecimiento de los hechos, y, en todo caso, en el plazo maximo de **setenta y dos horas**, el detenido debera ser puesto en libertad o a disposicion de la autoridad judicial."

**Por que D es correcta (72 horas):**
El art. 17.2 CE establece un plazo maximo absoluto de **72 horas** (3 dias) para la detencion preventiva. Dentro de ese plazo, el detenido debe ser puesto en libertad o a disposicion judicial. Este plazo es un limite constitucional que no puede superarse en ningun caso. Ademas, el articulo senala que la detencion no debe durar mas del tiempo "estrictamente necesario", por lo que las 72 horas son un maximo, no un plazo estandar.

**Por que las demas son incorrectas (plazos diferentes):**

- **A)** "**24 horas**." Falso: el plazo constitucional es de 72 horas, no de 24. Las 24 horas no aparecen en el art. 17 CE. Este dato puede confundirse con el plazo que tiene el juez para resolver sobre la situacion del detenido tras recibirlo (art. 17.4: habeas corpus), o con el plazo en legislacion comparada.

- **B)** "**48 horas**." Falso: tampoco es el plazo correcto. 48 horas es un plazo que puede aparecer en otros contextos legales, pero el art. 17.2 CE establece 72 horas.

- **C)** "**36 horas**." Falso: no es el plazo constitucional. 36 horas no aparece en ningun apartado del art. 17 CE.

**Plazos del art. 17 CE (detencion):**

| Concepto | Plazo |
|----------|-------|
| **Detencion preventiva maxima (art. 17.2)** | **72 horas** |
| Informacion de derechos al detenido (art. 17.3) | De forma **inmediata** |
| Habeas corpus (art. 17.4) | Produccion inmediata ante juez |

**Clave:** Detencion preventiva = maximo 72 horas (art. 17.2 CE). Es un derecho fundamental (Seccion 1.a, Capitulo II, Titulo I), protegido por recurso de amparo y procedimiento preferente y sumario.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "30d1dd58-7530-417e-b57c-d9744b05f481");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.17.2 detencion 72 horas (" + exp3.length + " chars)");
})();
