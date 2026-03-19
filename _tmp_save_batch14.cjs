require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - RD 364/1995 art.70 grado personal
  const exp1 = `**Articulo 70.3 del RD 364/1995** (Grado personal inicial):

> "Los funcionarios consolidaran necesariamente como grado personal inicial el correspondiente al nivel del puesto de trabajo adjudicado tras la superacion del proceso selectivo, **salvo que con caracter voluntario pasen a desempenar un puesto de nivel inferior**, en cuyo caso consolidaran el correspondiente a este ultimo."

**Por que D es correcta:**
La unica excepcion que contempla el art. 70.3 es pasar **voluntariamente** a un puesto de nivel inferior. En ese caso, se consolida el grado del puesto inferior, no el inicial. Las opciones A, B y C describen situaciones que no estan contempladas como excepcion en este articulo.

**Por que las demas son incorrectas:**

- **A)** Plan de ordenacion de empleo con reasignacion. Falso: el art. 70.3 no menciona los planes de empleo como excepcion. La reasignacion forzosa no altera la regla general de consolidacion del grado inicial.

- **B)** Comision de servicios forzosa a puesto superior. Falso: la comision de servicios (art. 64) tiene sus propias reglas. El art. 70.3 solo contempla como excepcion el desempeno **voluntario** de un puesto **inferior**, no el desempeno forzoso de uno superior.

- **C)** Reconocimiento de grado consolidado en otra Administracion. Falso: aunque el art. 70 regula el grado personal, el apartado 3 no menciona esta situacion como excepcion. El reconocimiento de grado de otra Administracion se rige por otras normas.

**Clave:** La unica excepcion del art. 70.3 es: paso **voluntario** a puesto de nivel **inferior** = se consolida el grado de ese puesto inferior.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "a35aeeb3-47c1-46b8-87de-3d19a23f67c3");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - RD 364/1995 art.70 grado personal (" + exp1.length + " chars)");

  // #2 - CE art.168 reforma agravada
  const exp2 = `**Articulo 168 de la Constitucion Espanola** (Reforma agravada):

> "Cuando se propusiere la revision total de la Constitucion o una parcial que afecte al **Titulo preliminar**, al **Capitulo segundo, Seccion primera del Titulo I**, o al **Titulo II**, se procedera a la aprobacion del principio por mayoria de dos tercios de cada Camara, y a la disolucion inmediata de las Cortes."

**Por que C es correcta (NO requiere art. 168):**
La opcion C dice "De las **garantias** de las libertades y derechos fundamentales", que es el **Capitulo IV** del Titulo I (arts. 53-54). Este capitulo NO esta protegido por el art. 168. Su reforma seguiria el procedimiento ordinario del art. 167.

**Por que las demas son incorrectas (SI requieren art. 168):**

- **A)** "Principios basicos de la Constitucion" = **Titulo Preliminar** (arts. 1-9). Expresamente protegido por el art. 168.

- **B)** "De la Corona" = **Titulo II** (arts. 56-65). Expresamente protegido por el art. 168.

- **D)** "De los derechos fundamentales y de las libertades publicas" = **Capitulo II, Seccion 1a del Titulo I** (arts. 15-29). Expresamente protegido por el art. 168.

**Estructura del Titulo I (clave para distinguir):**
| Parte | Articulos | Proteccion art. 168 |
|-------|-----------|---------------------|
| Cap. I: Espanoles y extranjeros | 11-13 | No |
| Cap. II, Sec. 1a: Derechos fundamentales | 15-29 | **Si** |
| Cap. II, Sec. 2a: Derechos y deberes | 30-38 | No |
| Cap. III: Principios rectores | 39-52 | No |
| Cap. IV: Garantias | 53-54 | No |

**Truco:** C y D suenan parecido pero son capitulos distintos. D es Seccion 1a del Cap. II (protegida). C es Cap. IV (no protegida).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "aa20a498-e317-468c-bd2b-22da2f0caeb3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.168 reforma agravada (" + exp2.length + " chars)");

  // #3 - Ley 50/1997 art.27 tramitacion urgente
  const exp3 = `**Articulo 27.1 de la Ley 50/1997** (Tramitacion urgente):

> "El **Consejo de Ministros**, a propuesta del titular del departamento al que corresponda la iniciativa normativa, podra acordar la **tramitacion urgente** del procedimiento de elaboracion y aprobacion de anteproyectos de ley, reales decretos legislativos y de reales decretos."

**Por que D es correcta:**
El art. 27.1 atribuye al **Consejo de Ministros** la competencia para acordar la tramitacion urgente. Es el organo colegiado del Gobierno, no un organo unipersonal. La propuesta viene del Ministro responsable, pero la decision es del Consejo.

**Por que las demas son incorrectas:**

- **A)** "Presidente del Gobierno". Falso: aunque el Presidente dirige la accion del Gobierno (art. 2 Ley 50/1997), la tramitacion urgente la acuerda el Consejo de Ministros, no el Presidente individualmente.

- **B)** "Cortes Generales". Falso: las Cortes tienen su propio procedimiento de tramitacion urgente legislativa (arts. 93-94 Reglamento del Congreso), pero el art. 27 de la Ley del Gobierno se refiere a la fase **prelegislativa** (elaboracion de anteproyectos), que es competencia exclusiva del Gobierno.

- **C)** "Ministro responsable". Falso: el Ministro **propone** la tramitacion urgente, pero quien la **acuerda** es el Consejo de Ministros. La distincion entre "proponer" y "acordar" es clave.

**Efectos de la tramitacion urgente (art. 27.2):**
- Los plazos del procedimiento se reducen a la **mitad**
- Excepto: dictamen del Consejo de Estado (se mantiene integro)`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "76a1d68d-bfc6-4777-9b85-c95f84d56152");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 50/1997 art.27 urgente (" + exp3.length + " chars)");
})();
