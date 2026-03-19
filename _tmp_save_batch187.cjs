require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 40/2015 art.36.4 plazo 15 días alegaciones responsabilidad personal
  const exp1 = `**Articulo 36.4 de la Ley 40/2015 (LRJSP) - Responsabilidad de autoridades y personal:**

> Art. 36.4: "El procedimiento para la exigencia de la responsabilidad [...] contara con un plazo de **alegaciones** de **quince dias**."

**Por que A es correcta (15 dias):**
El art. 36.4 LRJSP establece un plazo de **15 dias** para que las autoridades o personal al servicio de la Administracion presenten alegaciones en el procedimiento de exigencia de responsabilidad patrimonial por via de regreso (accion de repeticion).

**Por que las demas son incorrectas:**

- **B)** "**20 dias**." Falso: el plazo de 20 dias no aparece en el art. 36 para las alegaciones en este procedimiento. Es una cifra cercana pero incorrecta.

- **C)** "**5 dias**." Falso: 5 dias seria un plazo insuficiente para un procedimiento de responsabilidad. El art. 36.4 establece 15, no 5.

- **D)** "**10 dias**." Falso: 10 dias es un plazo comun en otros tramites administrativos (como la subsanacion del art. 68 Ley 39/2015), pero en el procedimiento de responsabilidad del art. 36 LRJSP el plazo es de 15 dias.

**Procedimiento de responsabilidad patrimonial (art. 36 LRJSP):**
1. La Administracion indemniza al lesionado (responsabilidad directa)
2. Despues, exige de oficio la responsabilidad al personal causante (accion de regreso)
3. Solo procede cuando hubo **dolo, culpa o negligencia grave**
4. Plazo de alegaciones: **15 dias**
5. Se pondera el resultado danoso, la existencia de intencionalidad, la responsabilidad profesional y la relacion con el resultado

**Clave:** El plazo de alegaciones en la accion de regreso contra el personal es de **15 dias** (art. 36.4 LRJSP).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "05f3ea93-ac89-4907-b166-4f016829e1a9");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 art.36 responsabilidad 15 dias (" + exp1.length + " chars)");

  // #2 - Ley 39/2015 estructura título preliminar + 6 títulos + 9 DA...
  const exp2 = `**Estructura de la Ley 39/2015 (LPAC) - 133 articulos:**

**Por que B es correcta:**
La Ley 39/2015 se estructura en: **Titulo Preliminar** + **6 titulos** + **9 disposiciones adicionales** + **5 disposiciones transitorias** + **1 disposicion derogatoria** + **7 disposiciones finales**. La opcion B es la unica que recoge correctamente todos estos datos.

**Por que las demas son incorrectas (cada una altera algun dato):**

- **A)** Dice "**siete** titulos, **cuatro** DA, **cuatro** DT, **dos** DD, **seis** DF." Errores: son 6 titulos (no 7), 9 DA (no 4), 5 DT (no 4), 1 DD (no 2) y 7 DF (no 6). Practicamente todos los datos son incorrectos.

- **C)** Dice "**seis** titulos, **cuatro** DA, **cinco** DT, **dos** DD, **cinco** DF." Errores: acierta en 6 titulos y 5 DT, pero son 9 DA (no 4), 1 DD (no 2) y 7 DF (no 5).

- **D)** Dice "**siete** titulos, **cinco** DA, **cuatro** DT, **una** DD, **tres** DF." Errores: son 6 titulos (no 7), 9 DA (no 5), 5 DT (no 4) y 7 DF (no 3). Solo acierta en 1 DD.

**Estructura completa de la Ley 39/2015:**

| Parte | Contenido |
|-------|-----------|
| Titulo Preliminar | Disposiciones generales (arts. 1-2) |
| Titulo I | Interesados (arts. 3-12) |
| Titulo II | Actividad de las AAPP (arts. 13-33) |
| Titulo III | Actos administrativos (arts. 34-52) |
| Titulo IV | Procedimiento administrativo comun (arts. 53-105) |
| Titulo V | Revision de actos en via administrativa (arts. 106-126) |
| Titulo VI | Iniciativa legislativa y potestad reglamentaria (arts. 127-133) |
| | **9 DA + 5 DT + 1 DD + 7 DF** |

**Mnemotecnia:** Ley 39/2015: **6** titulos, **9** DA, **5** DT, **1** DD, **7** DF. Recuerda: 6-9-5-1-7.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "e553b10c-beea-41ac-a5a1-103e79957bc2");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 39/2015 estructura (" + exp2.length + " chars)");
})();
