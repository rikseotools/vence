require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LO 1/2004 art.24 excedencia funcionaria violencia genero
  const exp1 = `**Articulo 24 de la LO 1/2004:**

> "La funcionaria victima de violencia de genero tendra derecho a la **reduccion o a la reordenacion de su tiempo de trabajo**, a la **movilidad geografica** de centro de trabajo y a la **excedencia** en los terminos que se determinen en su legislacion especifica."

**Por que C es correcta (excedencia por violencia de genero):**
El art. 24 LO 1/2004 introduce tres medidas de apoyo para la funcionaria victima de violencia de genero, y la **excedencia** es una de ellas. Esta excedencia no requiere tiempo minimo de servicios previos y el puesto se reserva durante 6 meses (ampliables hasta 18 por el juez).

**Por que las demas son incorrectas:**

- **A)** "Reserva de plaza en procesos de promocion interna". Falso: el art. 24 no menciona ninguna reserva de plaza en promocion interna. Las tres medidas son: reduccion/reordenacion del tiempo de trabajo, movilidad geografica y excedencia.

- **B)** "Consideracion de las faltas de asistencia como faltas leves". Falso: el art. 24 no menciona la calificacion de faltas de asistencia. Las ausencias justificadas por violencia de genero no se consideran "faltas leves" sino que simplemente se justifican, pero esto no es una medida del art. 24.

- **D)** "Reduccion de jornada sin disminucion de retribucion". Falso: el art. 24 dice "reduccion o reordenacion de su tiempo de trabajo", pero **no dice "sin disminucion de retribucion"**. La trampa anade una garantia retributiva que el articulo no establece.

**Medidas del art. 24 LO 1/2004 (funcionarias):**
1. Reduccion o reordenacion del tiempo de trabajo
2. Movilidad geografica de centro de trabajo
3. **Excedencia** por violencia de genero

**Clave:** La excedencia SI esta en el art. 24. La reserva de plaza en promocion, las faltas leves y la reduccion "sin disminucion de retribucion" NO.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "653ed1c2-ec54-448c-a075-f644fd44f130");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LO 1/2004 excedencia funcionaria (" + exp1.length + " chars)");

  // #2 - LOPJ art.58.Tercero solicitud CGPJ proteccion datos
  const exp2 = `**Articulo 58.Tercero de la LO 6/1985 (LOPJ):**

> "La Sala de lo Contencioso-administrativo del Tribunal Supremo conocera de [...] la solicitud de autorizacion para la declaracion prevista en la disposicion adicional quinta de la LO 3/2018 (Proteccion de Datos), cuando tal solicitud sea formulada por el **Consejo General del Poder Judicial**."

**Por que D es correcta (CGPJ):**
La Sala de lo C-A del TS conoce de esta solicitud especifica cuando la formula el **CGPJ**. Se trata de un procedimiento para cuestionar la validez de decisiones de la Comision Europea en materia de transferencias internacionales de datos, y el CGPJ es quien tiene legitimacion para solicitar esa autorizacion ante el TS.

**Por que las demas son incorrectas:**

- **A)** "La Agencia Espanola de Proteccion de Datos". Falso: aunque la AEPD es la autoridad de proteccion de datos en Espana y participa en estos procedimientos, el art. 58.Tercero LOPJ atribuye expresamente la legitimacion al **CGPJ**, no a la AEPD, para la solicitud ante el TS.

- **B)** "El Fiscal General". Falso: el Fiscal General del Estado no tiene atribuida esta competencia en el art. 58 LOPJ. Su funcion es promover la accion de la justicia, no solicitar autorizaciones sobre decisiones de la Comision Europea en materia de datos.

- **C)** "El titular del Ministerio de Justicia". Falso: el Ministro de Justicia no aparece en el art. 58.Tercero como legitimado para esta solicitud. Seria incoherente que un miembro del Gobierno solicitara esta autorizacion, ya que se trata de una competencia del organo de gobierno del Poder Judicial (CGPJ).

**Competencias de la Sala de lo C-A del TS (art. 58 LOPJ):**
- 1o: Recursos contra actos del Consejo de Ministros, CGPJ, Congreso, Senado, TC, Tribunal de Cuentas, Defensor del Pueblo
- 2o: Casacion y revision
- 3o: **Solicitud del CGPJ** sobre proteccion de datos (LO 3/2018)
- 4o: Solicitud del Gobierno sobre telecomunicaciones (Ley 11/2022)`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "36902e60-5309-4dc5-b6b2-93013437b122");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LOPJ art.58 CGPJ datos (" + exp2.length + " chars)");
})();
