require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 50/1997 art.26 informes preceptivos plazos
  const exp1 = `**Articulo 26.5 de la Ley 50/1997** (Informes preceptivos en elaboracion de normas):

> "Los informes preceptivos se emitiran en un plazo de **diez dias**, o de **un mes** cuando el informe se solicite a otra Administracion o a un organo u Organismo dotado de especial independencia o autonomia."

**Por que D es correcta (10 dias / 1 mes):**
El art. 26.5 de la Ley del Gobierno establece dos plazos para emitir informes preceptivos:
- **Regla general:** 10 dias
- **Excepcion:** 1 mes, cuando se solicita a otra Administracion o a un organo con especial independencia/autonomia (ej: Consejo de Estado, CNMC)

**Por que las demas son incorrectas (trampas con numeros):**

| Opcion | Plazo general | Plazo ampliado | Error |
|--------|--------------|----------------|-------|
| A | **15** dias | **2** meses | Ambos plazos incorrectos |
| B | **15** dias | 1 mes | Plazo general incorrecto |
| C | 10 dias | **2** meses | Plazo ampliado incorrecto |
| **D** | **10** dias | **1** mes | **Correcta** |

- **A)** Cambia ambos plazos: 15 dias (en vez de 10) y 2 meses (en vez de 1). Doblemente falsa.
- **B)** Cambia 10 por 15 dias. El plazo ampliado (1 mes) si es correcto, pero el general no.
- **C)** El plazo general (10 dias) es correcto, pero cambia 1 mes por 2 meses.

**Clave para recordar:** Informes preceptivos = **10** dias (general) / **1** mes (otra Administracion u organo independiente). No confundir con el plazo de informes del art. 80 Ley 39/2015, que tambien es de 10 dias pero sin la ampliacion a 1 mes.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "213e02fc-c861-4b79-9b47-e56806e22e14");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 50/1997 informes plazos (" + exp1.length + " chars)");

  // #2 - RDL 5/2015 art.16 carrera horizontal
  const exp2 = `**Articulo 16.3.a) del RDL 5/2015 (TREBEP):**

> "Carrera horizontal, que consiste en la **progresion de grado, categoria, escalon** u otros conceptos analogos, **sin necesidad de cambiar de puesto de trabajo**."

**Por que B es correcta (carrera horizontal):**
La carrera horizontal es la unica modalidad que permite progresar profesionalmente (subir de grado, categoria o escalon) **sin cambiar de puesto de trabajo**. El funcionario mejora sus condiciones retributivas y de reconocimiento permaneciendo en el mismo puesto.

**Por que las demas son incorrectas:**

- **A)** "Promocion interna horizontal". Falso: la promocion interna horizontal (art. 16.3.d) consiste en el **acceso a cuerpos o escalas del mismo Subgrupo profesional**. No es progresion de grado/escalon, sino cambio de cuerpo dentro del mismo nivel.

- **C)** "Promocion interna vertical". Falso: la promocion interna vertical (art. 16.3.c) consiste en el **ascenso desde un Subgrupo a otro superior** (ej: de C1 a A2). Implica cambiar de cuerpo/escala, no simplemente progresar de grado.

- **D)** "Carrera vertical". Falso: la carrera vertical (art. 16.3.b) consiste en el **ascenso en la estructura de puestos** mediante los procedimientos de provision (concurso, libre designacion). Aqui SI se cambia de puesto de trabajo.

**Las 4 modalidades de carrera del art. 16.3 TREBEP:**

| Modalidad | En que consiste | Cambia de puesto? |
|-----------|----------------|-------------------|
| **Carrera horizontal** | Progresion de grado/escalon | **NO** |
| Carrera vertical | Ascenso en estructura de puestos | SI |
| Promocion interna vertical | Ascenso de Subgrupo inferior a superior | SI (de cuerpo) |
| Promocion interna horizontal | Acceso a cuerpo del mismo Subgrupo | SI (de cuerpo) |

**Clave:** "Sin cambiar de puesto" = **carrera horizontal**. Es la unica modalidad que lo permite.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "5f79fd37-4ccd-4d19-8ee9-ac61a94d93a7");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - TREBEP carrera horizontal (" + exp2.length + " chars)");
})();
