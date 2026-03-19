require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.9.3 retroactividad desfavorable NO garantizada
  const exp1 = `**Articulo 9.3 de la Constitucion Espanola - Principios garantizados:**

> "La Constitucion garantiza el principio de legalidad, la jerarquia normativa, la publicidad de las normas, la **irretroactividad** de las disposiciones sancionadoras **no favorables** o restrictivas de derechos individuales, la seguridad juridica, la responsabilidad y la interdiccion de la arbitrariedad de los poderes publicos."

**Por que A NO esta garantizada en la CE:**
La opcion A dice "la **retroactividad** de una disposicion sancionadora **desfavorable**". La CE garantiza exactamente lo contrario: la **irretroactividad** (no retroactividad) de las disposiciones sancionadoras **no favorables**. Es decir, una ley sancionadora desfavorable NO puede aplicarse retroactivamente. La CE protege contra eso.

**Por que las demas SI estan garantizadas:**

- **B)** "La **jerarquia normativa**." **SI**: expresamente incluida en el art. 9.3. Significa que las normas de rango inferior no pueden contradecir a las de rango superior (Constitucion > ley organica > ley ordinaria > reglamento).

- **C)** "La **responsabilidad** de los poderes publicos." **SI**: incluida en el art. 9.3. Los poderes publicos responden por los danos que causen en su actuacion.

- **D)** "La **publicidad** de las normas." **SI**: incluida en el art. 9.3. Las normas deben ser publicadas oficialmente (BOE, boletines autonomicos) para que los ciudadanos puedan conocerlas.

**Los 7 principios del art. 9.3 CE:**
1. Legalidad
2. Jerarquia normativa
3. Publicidad de las normas
4. **Irretroactividad** de disposiciones sancionadoras no favorables
5. Seguridad juridica
6. Responsabilidad de los poderes publicos
7. Interdiccion de la arbitrariedad

**Clave:** La CE garantiza la **irretroactividad** (no la retroactividad) de normas sancionadoras desfavorables. La trampa invierte el prefijo "ir-" cambiando completamente el significado.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "423a3373-11d0-42fb-a8a9-9b14e0f1b61f");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.9.3 retroactividad (" + exp1.length + " chars)");

  // #2 - CE art.159.1 composición TC 12 miembros 3/5
  const exp2 = `**Articulo 159.1 de la Constitucion Espanola - Composicion del TC:**

> "El Tribunal Constitucional se compone de **12 miembros** nombrados por el Rey; de ellos, **cuatro** a propuesta del Congreso por mayoria de **tres quintos**; cuatro a propuesta del Senado, con identica mayoria; dos a propuesta del Gobierno, y dos a propuesta del CGPJ."

**Por que D es correcta:**
La opcion D reproduce fielmente el art. 159.1: **12** miembros, **4+4** de las Cortes por mayoria de **3/5**, 2 del Gobierno, 2 del CGPJ.

**Por que las demas son incorrectas:**

- **A)** Dice "**10** miembros" y "**tres** a propuesta de cada Camara". Falso: son **12** miembros, no 10. Y son **cuatro** por cada Camara (4+4 = 8), no tres (3+3 = 6). La cifra total y el reparto son diferentes.

- **B)** Dice mayoria de "**dos tercios**". Falso: el art. 159.1 exige **tres quintos** (3/5 = 60%), no dos tercios (2/3 = 66,7%). La trampa es sutil porque ambas son mayorias cualificadas, pero la fraccion es diferente.

- **C)** Dice mayoria de "**tres cuartos**". Falso: tres cuartos (3/4 = 75%) es una mayoria mucho mas exigente que tres quintos (3/5 = 60%). La CE no exige 3/4 para ningun nombramiento del TC.

**Comparacion de mayorias:**

| Fraccion | Porcentaje | En el art. 159 |
|----------|-----------|----------------|
| **3/5** | **60%** | **SI (correcta)** |
| 2/3 | 66,7% | NO |
| 3/4 | 75% | NO |

**Clave:** TC = 12 miembros + 3/5 (tres quintos). No confundir 3/5 con 2/3 ni con 3/4.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "2cda650c-98ee-47f6-9590-fd7e6ca48721");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.159.1 composicion TC (" + exp2.length + " chars)");

  // #3 - CE art.159.2 / LOTC art.18 requisitos magistrados TC 15 años
  const exp3 = `**Articulo 159.2 CE / Art. 18 LOTC - Requisitos para ser magistrado del TC:**

> "Los miembros del Tribunal Constitucional deberan ser nombrados entre ciudadanos espanoles que sean **Magistrados, Fiscales, Profesores de Universidad, funcionarios publicos o Abogados**, todos ellos juristas de reconocida competencia con **mas de quince anos** de ejercicio profesional o en activo en la respectiva funcion."

**Por que B es correcta (juristas con mas de 15 anos):**
El art. 159.2 CE y el art. 18 LOTC establecen que los magistrados del TC deben ser: (1) de alguna de las profesiones listadas, (2) juristas de reconocida competencia, y (3) con **mas de 15 anos** de ejercicio. La opcion B sintetiza correctamente estos requisitos.

**Por que las demas son incorrectas:**

- **A)** Dice "**veinte anos** de ejercicio profesional". Falso: el art. 159.2 CE dice "**quince** anos", no veinte. La trampa anade cinco anos al requisito real. Ademas, la opcion A limita la lista a profesiones concretas cuando B las resume correctamente como "juristas".

- **C)** Dice "**solo** miembros de las carreras judicial y fiscal, con mas de **diez** anos". Contiene **dos errores**: (1) no son "solo" jueces y fiscales, tambien pueden ser profesores de universidad, funcionarios publicos y abogados; (2) el plazo es 15 anos, no 10. La trampa reduce tanto el ambito de profesiones como el tiempo requerido.

- **D)** Equipara los requisitos a los de "Consejeros natos del Consejo de Estado". Falso: los requisitos para magistrados del TC y los de Consejeros natos del Consejo de Estado son diferentes y se regulan en normas distintas (CE/LOTC vs Ley Organica del Consejo de Estado). No hay tal equiparacion.

**Requisitos para magistrado del TC:**
- Ciudadano espanol
- Profesion: Magistrado, Fiscal, Profesor de Universidad, funcionario publico o Abogado
- Jurista de reconocida competencia
- **Mas de 15 anos** de ejercicio profesional

**Clave:** 15 anos (no 10 ni 20). Y no solo jueces/fiscales: tambien profesores, funcionarios y abogados.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "bf1ded2d-dfbf-425c-9576-d714ab21b7b2");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.159.2 requisitos TC 15 anos (" + exp3.length + " chars)");
})();
